import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useBranch } from "@/contexts/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const CS_NAMES = ["Farah", "Intan", "Rizki", "Sefhia", "Yola"];

const MONTHS = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

const MONTH_NAME_TO_NUMBER: Record<string, number> = {
  januari: 1, jan: 1,
  februari: 2, feb: 2,
  maret: 3, mar: 3,
  april: 4, apr: 4,
  mei: 5, may: 5,
  juni: 6, jun: 6,
  juli: 7, jul: 7,
  agustus: 8, agu: 8, aug: 8,
  september: 9, sep: 9, sept: 9,
  oktober: 10, okt: 10, oct: 10,
  november: 11, nov: 11,
  desember: 12, des: 12, dec: 12,
};

interface SH2MRevenueData {
  id: string;
  tahun: number;
  bulan: number;
  omset: number;
  nama_cs: string;
  asal_iklan: string;
}

export default function SH2MRevenue() {
  const { selectedBranch, getBranchFilter } = useBranch();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [editingData, setEditingData] = useState<SH2MRevenueData | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    tahun: currentYear,
    bulan: new Date().getMonth() + 1,
    omset: 0,
    nama_cs: "",
  });

  const branchFilter = getBranchFilter();

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["sh2m-revenue", branchFilter],
    queryFn: async () => {
      let query = supabase
        .from("sh2m_revenue")
        .select("*")
        .order("tahun", { ascending: false })
        .order("bulan", { ascending: false });

      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SH2MRevenueData[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("sh2m_revenue").insert({
        tahun: data.tahun,
        bulan: data.bulan,
        omset: data.omset,
        nama_cs: data.nama_cs,
        asal_iklan: branchFilter || "SEFT Corp - Jogja",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-revenue"] });
      toast.success("Data berhasil ditambahkan");
      setIsAddOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Gagal menambahkan data: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SH2MRevenueData) => {
      const { error } = await supabase
        .from("sh2m_revenue")
        .update({
          tahun: data.tahun,
          bulan: data.bulan,
          omset: data.omset,
          nama_cs: data.nama_cs,
        })
        .eq("id", data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-revenue"] });
      toast.success("Data berhasil diupdate");
      setIsEditOpen(false);
      setEditingData(null);
    },
    onError: (error) => {
      toast.error("Gagal mengupdate data: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sh2m_revenue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-revenue"] });
      toast.success("Data berhasil dihapus");
    },
    onError: (error) => {
      toast.error("Gagal menghapus data: " + error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      tahun: currentYear,
      bulan: new Date().getMonth() + 1,
      omset: 0,
      nama_cs: "",
    });
  };

  const parseMonth = (value: any): number => {
    if (typeof value === "number") {
      return value >= 1 && value <= 12 ? value : 1;
    }
    if (typeof value === "string") {
      const num = parseInt(value);
      if (!isNaN(num) && num >= 1 && num <= 12) return num;
      
      const lower = value.toLowerCase().trim();
      return MONTH_NAME_TO_NUMBER[lower] || 1;
    }
    return 1;
  };

  const parseOmset = (value: any): number => {
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      const cleaned = value.replace(/[^\d.-]/g, "");
      return parseInt(cleaned) || 0;
    }
    return 0;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(5);

    try {
      const data = await file.arrayBuffer();
      setUploadProgress(15);

      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      setUploadProgress(30);

      if (jsonData.length === 0) {
        toast.error("File tidak memiliki data");
        return;
      }

      const parsedData: Array<{
        tahun: number;
        bulan: number;
        omset: number;
        nama_cs: string;
        asal_iklan: string;
      }> = [];

      for (const row of jsonData as any[]) {
        const tahun = parseInt(row.tahun || row.Tahun || row.TAHUN) || currentYear;
        const bulan = parseMonth(row.bulan || row.Bulan || row.BULAN);
        const omset = parseOmset(row.omset || row.Omset || row.OMSET || row["Jumlah Omset"] || row["jumlah omset"]);
        const nama_cs = String(row.nama_cs || row["Nama CS"] || row["nama cs"] || row.NamaCS || row["Nama_CS"] || "").trim();

        if (nama_cs) {
          parsedData.push({
            tahun,
            bulan,
            omset,
            nama_cs,
            asal_iklan: branchFilter || "SEFT Corp - Jogja",
          });
        }
      }

      setUploadProgress(50);

      if (parsedData.length === 0) {
        toast.error("Tidak ada data valid untuk diupload. Pastikan kolom Nama CS terisi.");
        return;
      }

      // Insert in batches
      const batchSize = 100;
      for (let i = 0; i < parsedData.length; i += batchSize) {
        const batch = parsedData.slice(i, i + batchSize);
        const { error } = await supabase.from("sh2m_revenue").insert(batch);
        if (error) throw error;
        setUploadProgress(50 + ((i + batchSize) / parsedData.length) * 50);
      }

      setUploadProgress(100);
      queryClient.invalidateQueries({ queryKey: ["sh2m-revenue"] });
      toast.success(`${parsedData.length} data berhasil diupload`);
      setIsUploadOpen(false);

    } catch (error: any) {
      toast.error("Gagal upload: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAdd = () => {
    if (!formData.nama_cs) {
      toast.error("Nama CS wajib diisi");
      return;
    }
    addMutation.mutate(formData);
  };

  const handleEdit = (data: SH2MRevenueData) => {
    setEditingData(data);
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (editingData) {
      updateMutation.mutate(editingData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm("Apakah Anda yakin ingin menghapus data ini?")) {
      deleteMutation.mutate(id);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getMonthName = (month: number) => {
    return MONTHS.find((m) => m.value === month)?.label || "-";
  };

  // Summary calculations
  const totalOmset = revenueData?.reduce((sum, d) => sum + Number(d.omset), 0) || 0;

  // Generate year options (current year and 5 years back)
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Revenue SH2M - {selectedBranch}</h1>
        <div className="flex gap-2">
          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Data Revenue SH2M</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Format kolom yang diharapkan: <strong>Tahun, Bulan, Nama CS, Omset</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Bulan bisa berupa angka (1-12) atau nama bulan (Januari, Februari, dll)
                </p>
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} />
                    <p className="text-sm text-center text-muted-foreground">
                      {uploadProgress}% - Mengupload...
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Tambah Data
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah Data Revenue SH2M</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Tahun *</Label>
                  <Select
                    value={formData.tahun.toString()}
                    onValueChange={(value) => setFormData({ ...formData, tahun: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tahun" />
                    </SelectTrigger>
                    <SelectContent>
                      {yearOptions.map((year) => (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Bulan *</Label>
                  <Select
                    value={formData.bulan.toString()}
                    onValueChange={(value) => setFormData({ ...formData, bulan: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((month) => (
                        <SelectItem key={month.value} value={month.value.toString()}>
                          {month.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Nama CS *</Label>
                  <Select
                    value={formData.nama_cs}
                    onValueChange={(value) => setFormData({ ...formData, nama_cs: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih CS" />
                    </SelectTrigger>
                    <SelectContent>
                      {CS_NAMES.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Jumlah Omset</Label>
                  <Input
                    type="number"
                    value={formData.omset}
                    onChange={(e) => setFormData({ ...formData, omset: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <Button onClick={handleAdd} className="w-full" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Total Omset</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatCurrency(totalOmset)}</p>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tahun</TableHead>
                <TableHead>Bulan</TableHead>
                <TableHead>Nama CS</TableHead>
                <TableHead className="text-right">Jumlah Omset</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.tahun}</TableCell>
                  <TableCell>{getMonthName(row.bulan)}</TableCell>
                  <TableCell>{row.nama_cs}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(row.omset))}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(row)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!revenueData || revenueData.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Belum ada data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Data Revenue SH2M</DialogTitle>
          </DialogHeader>
          {editingData && (
            <div className="space-y-4">
              <div>
                <Label>Tahun *</Label>
                <Select
                  value={editingData.tahun.toString()}
                  onValueChange={(value) => setEditingData({ ...editingData, tahun: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Bulan *</Label>
                <Select
                  value={editingData.bulan.toString()}
                  onValueChange={(value) => setEditingData({ ...editingData, bulan: parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month.value} value={month.value.toString()}>
                        {month.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nama CS *</Label>
                <Select
                  value={editingData.nama_cs}
                  onValueChange={(value) => setEditingData({ ...editingData, nama_cs: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih CS" />
                  </SelectTrigger>
                  <SelectContent>
                    {CS_NAMES.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Jumlah Omset</Label>
                <Input
                  type="number"
                  value={editingData.omset}
                  onChange={(e) => setEditingData({ ...editingData, omset: parseInt(e.target.value) || 0 })}
                />
              </div>
              <Button onClick={handleUpdate} className="w-full" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Menyimpan..." : "Update"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
