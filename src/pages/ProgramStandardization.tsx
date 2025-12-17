import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RefreshCw, Wand2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Indonesian months for auto-extraction
const INDONESIAN_MONTHS = [
  'JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI',
  'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'
];

// Suffix patterns to detect
const SUFFIX_PATTERNS = ['(PB)', '(ALUMNI)', '(CICILAN)', '(PELUNASAN)'];

// Auto-extract logic for nama_program
const autoExtract = (namaProgram: string): { namaStandar: string; pelaksanaan: string; suffix: string } => {
  let namaStandar = namaProgram;
  let pelaksanaan = '';
  let suffix = '';

  // Extract suffix
  for (const pattern of SUFFIX_PATTERNS) {
    if (namaProgram.toUpperCase().includes(pattern)) {
      suffix = pattern.replace(/[()]/g, '');
      namaStandar = namaProgram.replace(new RegExp(pattern.replace(/[()]/g, '\\$&'), 'gi'), '').trim();
      break;
    }
  }

  // Extract month and year for pelaksanaan
  const monthYearRegex = new RegExp(`(${INDONESIAN_MONTHS.join('|')})\\s*(\\d{4})`, 'gi');
  const matches = [...namaStandar.matchAll(monthYearRegex)];
  
  if (matches.length > 0) {
    // If multiple month-year combos (bundling), combine them
    const pelaksanaanParts = matches.map(m => `${m[1].toUpperCase()} ${m[2]}`);
    pelaksanaan = pelaksanaanParts.join(' dan ');
    
    // Clean nama_standar by removing month-year patterns
    namaStandar = namaStandar.replace(monthYearRegex, '').trim();
  }

  // Clean up extra spaces and trailing punctuation
  namaStandar = namaStandar.replace(/\s+/g, ' ').replace(/[-_]+$/, '').trim();

  return { namaStandar, pelaksanaan, suffix };
};

interface MappingRow {
  id: string;
  nama_program_original: string;
  nama_standar: string | null;
  pelaksanaan: string | null;
  suffix: string | null;
  category: string | null;
}

export default function ProgramStandardization() {
  const [editedRows, setEditedRows] = useState<Record<string, Partial<MappingRow>>>({});
  const [confirmApply, setConfirmApply] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const queryClient = useQueryClient();

  const { data: mappings, isLoading } = useQuery({
    queryKey: ["program-mappings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_name_mappings")
        .select("*")
        .order("nama_program_original");
      if (error) throw error;
      return data as MappingRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (row: { id: string; nama_standar: string | null; pelaksanaan: string | null; suffix: string | null; category: string | null }) => {
      const { error } = await supabase
        .from("program_name_mappings")
        .update({
          nama_standar: row.nama_standar,
          pelaksanaan: row.pelaksanaan,
          suffix: row.suffix,
          category: row.category,
        })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program-mappings"] });
      toast.success("Mapping berhasil disimpan");
    },
    onError: () => {
      toast.error("Gagal menyimpan mapping");
    },
  });

  const handleFieldChange = (id: string, field: keyof MappingRow, value: string) => {
    setEditedRows(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value || null,
      }
    }));
  };

  const getFieldValue = (row: MappingRow, field: keyof MappingRow): string => {
    if (editedRows[row.id]?.[field] !== undefined) {
      return editedRows[row.id][field] as string || '';
    }
    return (row[field] as string) || '';
  };

  const handleSave = (row: MappingRow) => {
    const edited = editedRows[row.id] || {};
    saveMutation.mutate({
      id: row.id,
      nama_standar: edited.nama_standar !== undefined ? edited.nama_standar : row.nama_standar,
      pelaksanaan: edited.pelaksanaan !== undefined ? edited.pelaksanaan : row.pelaksanaan,
      suffix: edited.suffix !== undefined ? edited.suffix : row.suffix,
      category: edited.category !== undefined ? edited.category : row.category,
    });
    // Clear edited state for this row
    setEditedRows(prev => {
      const newState = { ...prev };
      delete newState[row.id];
      return newState;
    });
  };

  const handleAutoExtract = (row: MappingRow) => {
    const { namaStandar, pelaksanaan, suffix } = autoExtract(row.nama_program_original);
    setEditedRows(prev => ({
      ...prev,
      [row.id]: {
        nama_standar: namaStandar,
        pelaksanaan: pelaksanaan,
        suffix: suffix,
      }
    }));
  };

  const handleAutoExtractAll = () => {
    if (!mappings) return;
    const newEdits: Record<string, Partial<MappingRow>> = {};
    mappings.forEach(row => {
      // Only auto-extract if fields are empty
      if (!row.nama_standar && !row.pelaksanaan && !row.suffix) {
        const { namaStandar, pelaksanaan, suffix } = autoExtract(row.nama_program_original);
        newEdits[row.id] = {
          nama_standar: namaStandar,
          pelaksanaan: pelaksanaan,
          suffix: suffix,
        };
      }
    });
    setEditedRows(prev => ({ ...prev, ...newEdits }));
    toast.success(`Auto-extract selesai untuk ${Object.keys(newEdits).length} baris`);
  };

  const handleApplyToHighticket = async () => {
    setIsApplying(true);
    try {
      // Get all mappings with nama_standar filled
      const { data: allMappings, error: mappingError } = await supabase
        .from("program_name_mappings")
        .select("*")
        .not("nama_standar", "is", null);
      
      if (mappingError) throw mappingError;

      let updatedCount = 0;
      for (const mapping of allMappings || []) {
        const { error } = await supabase
          .from("highticket_data")
          .update({
            nama_program_standar: mapping.nama_standar,
            pelaksanaan_program: mapping.pelaksanaan,
            suffix_program: mapping.suffix,
          })
          .eq("nama_program", mapping.nama_program_original);
        
        if (!error) {
          updatedCount++;
        }
      }

      toast.success(`Berhasil update ${updatedCount} mapping ke highticket data`);
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
    } catch (error) {
      console.error("Error applying to highticket:", error);
      toast.error("Gagal menerapkan ke highticket data");
    } finally {
      setIsApplying(false);
      setConfirmApply(false);
    }
  };

  const hasEdits = Object.keys(editedRows).length > 0;
  const unmappedCount = mappings?.filter(m => !m.nama_standar).length || 0;
  const mappedCount = mappings?.filter(m => m.nama_standar).length || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Standarisasi Nama Program</h1>
          <p className="text-muted-foreground mt-1">
            Kelola mapping nama program original ke nama standar, pelaksanaan, dan suffix
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleAutoExtractAll}
            disabled={isLoading}
          >
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-Extract Semua
          </Button>
          <Button 
            onClick={() => setConfirmApply(true)}
            disabled={mappedCount === 0 || isApplying}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isApplying ? 'animate-spin' : ''}`} />
            Apply ke Highticket
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Program</CardDescription>
            <CardTitle className="text-3xl">{mappings?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sudah Dimapping</CardDescription>
            <CardTitle className="text-3xl text-green-600">{mappedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Belum Dimapping</CardDescription>
            <CardTitle className="text-3xl text-amber-600">{unmappedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[300px]">Nama Program Original</TableHead>
                <TableHead className="w-[200px]">Nama Standar</TableHead>
                <TableHead className="w-[200px]">Pelaksanaan</TableHead>
                <TableHead className="w-[120px]">Suffix</TableHead>
                <TableHead className="w-[120px]">Category</TableHead>
                <TableHead className="w-[150px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                </TableRow>
              ) : mappings?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center">Tidak ada data</TableCell>
                </TableRow>
              ) : (
                mappings?.map((row) => (
                  <TableRow key={row.id} className={!row.nama_standar && !editedRows[row.id]?.nama_standar ? "bg-amber-50 dark:bg-amber-950/20" : ""}>
                    <TableCell className="font-medium text-sm">
                      {row.nama_program_original}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={getFieldValue(row, 'nama_standar')}
                        onChange={(e) => handleFieldChange(row.id, 'nama_standar', e.target.value)}
                        placeholder="Nama standar..."
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={getFieldValue(row, 'pelaksanaan')}
                        onChange={(e) => handleFieldChange(row.id, 'pelaksanaan', e.target.value)}
                        placeholder="Pelaksanaan..."
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getFieldValue(row, 'suffix') || 'none'}
                        onValueChange={(value) => handleFieldChange(row.id, 'suffix', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="PB">PB</SelectItem>
                          <SelectItem value="ALUMNI">ALUMNI</SelectItem>
                          <SelectItem value="CICILAN">CICILAN</SelectItem>
                          <SelectItem value="PELUNASAN">PELUNASAN</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={getFieldValue(row, 'category') || 'none'}
                        onValueChange={(value) => handleFieldChange(row.id, 'category', value === 'none' ? '' : value)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="-" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">-</SelectItem>
                          <SelectItem value="Program">Program</SelectItem>
                          <SelectItem value="Merchandise">Merchandise</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAutoExtract(row)}
                          title="Auto-extract"
                        >
                          <Wand2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSave(row)}
                          disabled={saveMutation.isPending || !editedRows[row.id]}
                          title="Simpan"
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Apply Confirmation Dialog */}
      <AlertDialog open={confirmApply} onOpenChange={setConfirmApply}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Apply ke Highticket</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan mengupdate kolom <strong>nama_program_standar</strong>, <strong>pelaksanaan_program</strong>, dan <strong>suffix_program</strong> di semua data highticket berdasarkan mapping yang sudah dibuat.
              <br /><br />
              Total {mappedCount} mapping akan diterapkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleApplyToHighticket} disabled={isApplying}>
              {isApplying ? "Menerapkan..." : "Apply"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
