import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";

// Generate client ID: DDMMYYYY-IIIII-S
const generateClientId = (tanggal: Date, nama: string, nohp: string, sourceIklan: string) => {
  const day = String(tanggal.getDate()).padStart(2, '0');
  const month = String(tanggal.getMonth() + 1).padStart(2, '0');
  const year = tanggal.getFullYear();
  
  // Get initials (first 2 letters of first name)
  const nameParts = nama.trim().split(' ');
  const initials = nameParts[0].substring(0, 2).toUpperCase();
  
  // Get last 4 digits of phone
  const phoneDigits = nohp.replace(/\D/g, '').slice(-4);
  
  // Get initial of source iklan
  const sourceInitial = sourceIklan.charAt(0).toUpperCase();
  
  return `${day}${month}${year}-${initials}${phoneDigits}-${sourceInitial}`;
};

export default function SH2MData() {
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEC, setFilterEC] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  
  const queryClient = useQueryClient();

  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["sh2m-data", filterDate, filterStatus, filterEC],
    queryFn: async () => {
      let query = supabase.from("sh2m_data").select("*").order("tanggal", { ascending: false });
      
      if (filterDate) {
        query = query.eq("tanggal", filterDate);
      }
      if (filterStatus) {
        query = query.eq("status_payment", filterStatus);
      }
      if (filterEC) {
        query = query.ilike("nama_ec", `%${filterEC}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("sh2m_data")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      toast.success("Data berhasil diupdate");
      setEditingRow(null);
    },
    onError: () => {
      toast.error("Gagal mengupdate data");
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      const processedData = jsonData.map((row: any) => {
        const tanggal = new Date(row.tanggal || row.Tanggal || new Date());
        const nama = row.nama_client || row['Nama Client'] || '';
        const nohp = String(row.nohp_client || row['NoHP Client'] || '');
        const sourceIklan = row.source_iklan || row['Source Iklan'] || '';
        
        return {
          client_id: generateClientId(tanggal, nama, nohp, sourceIklan),
          tanggal: tanggal.toISOString().split('T')[0],
          nama_client: nama,
          nohp_client: nohp,
          source_iklan: sourceIklan,
          asal_iklan: row.asal_iklan || row['Asal Iklan'] || '',
          nama_ec: row.nama_ec || row['Nama EC'] || '',
          tanggal_update_paid: row.tanggal_update_paid ? new Date(row.tanggal_update_paid).toISOString().split('T')[0] : null,
          keterangan: row.keterangan || row.Keterangan || '',
          status_payment: row.status_payment || row['Status Payment'] || 'unpaid',
        };
      });

      const { error } = await supabase.from("sh2m_data").insert(processedData);
      
      if (error) throw error;
      
      toast.success(`${processedData.length} data berhasil diupload`);
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      setUploadDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengupload file");
    }
  };

  const handleManualAdd = async (formData: FormData) => {
    const tanggal = new Date(formData.get("tanggal") as string);
    const nama = formData.get("nama_client") as string;
    const nohp = formData.get("nohp_client") as string;
    const sourceIklan = formData.get("source_iklan") as string;
    
    const newData = {
      client_id: generateClientId(tanggal, nama, nohp, sourceIklan),
      tanggal: tanggal.toISOString().split('T')[0],
      nama_client: nama,
      nohp_client: nohp,
      source_iklan: sourceIklan,
      asal_iklan: formData.get("asal_iklan") as string,
      nama_ec: formData.get("nama_ec") as string,
      keterangan: formData.get("keterangan") as string,
      status_payment: formData.get("status_payment") as string || 'unpaid',
    };

    const { error } = await supabase.from("sh2m_data").insert(newData);
    
    if (error) {
      toast.error("Gagal menambahkan data");
      return;
    }
    
    toast.success("Data berhasil ditambahkan");
    queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
    setManualDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Data Client Closing Iklan (SH2M)</h1>
        <div className="flex gap-2">
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Excel
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Data dari Excel</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="file">Pilih File Excel</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Kolom yang diperlukan: tanggal, nama_client, nohp_client, source_iklan, asal_iklan, nama_ec, keterangan
                  </p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Tambah Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Tambah Data Manual</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleManualAdd(new FormData(e.currentTarget));
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal">Tanggal</Label>
                    <Input id="tanggal" name="tanggal" type="date" required />
                  </div>
                  <div>
                    <Label htmlFor="nama_client">Nama Client</Label>
                    <Input id="nama_client" name="nama_client" required />
                  </div>
                  <div>
                    <Label htmlFor="nohp_client">No HP Client</Label>
                    <Input id="nohp_client" name="nohp_client" required />
                  </div>
                  <div>
                    <Label htmlFor="source_iklan">Source Iklan</Label>
                    <Input id="source_iklan" name="source_iklan" required />
                  </div>
                  <div>
                    <Label htmlFor="asal_iklan">Asal Iklan</Label>
                    <Input id="asal_iklan" name="asal_iklan" />
                  </div>
                  <div>
                    <Label htmlFor="nama_ec">Nama EC</Label>
                    <Input id="nama_ec" name="nama_ec" />
                  </div>
                  <div>
                    <Label htmlFor="status_payment">Status Payment</Label>
                    <Select name="status_payment" defaultValue="unpaid">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="keterangan">Keterangan</Label>
                    <Input id="keterangan" name="keterangan" />
                  </div>
                </div>
                <Button type="submit" className="w-full">Tambah Data</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="filter-date">Filter Tanggal</Label>
              <Input
                id="filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filter-status">Filter Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Semua Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-ec">Filter EC</Label>
              <Input
                id="filter-ec"
                placeholder="Nama EC"
                value={filterEC}
                onChange={(e) => setFilterEC(e.target.value)}
              />
            </div>
          </div>
          {(filterDate || filterStatus || filterEC) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilterDate("");
                setFilterStatus("");
                setFilterEC("");
              }}
            >
              Reset Filter
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Client</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Source Iklan</TableHead>
              <TableHead>Asal Iklan</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Status Payment</TableHead>
              <TableHead>Tanggal Update</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : sh2mData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              sh2mData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>{new Date(row.tanggal).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell>{row.nama_client}</TableCell>
                  <TableCell>{row.nohp_client}</TableCell>
                  <TableCell>{row.source_iklan}</TableCell>
                  <TableCell>{row.asal_iklan}</TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Input
                        defaultValue={row.nama_ec || ''}
                        onBlur={(e) => updateMutation.mutate({
                          id: row.id,
                          updates: { nama_ec: e.target.value }
                        })}
                      />
                    ) : (
                      row.nama_ec
                    )}
                  </TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Select
                        defaultValue={row.status_payment || 'unpaid'}
                        onValueChange={(value) => updateMutation.mutate({
                          id: row.id,
                          updates: { status_payment: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${
                        row.status_payment === 'paid' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {row.status_payment}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Input
                        type="date"
                        defaultValue={row.tanggal_update_paid || ''}
                        onBlur={(e) => updateMutation.mutate({
                          id: row.id,
                          updates: { tanggal_update_paid: e.target.value }
                        })}
                      />
                    ) : (
                      row.tanggal_update_paid ? new Date(row.tanggal_update_paid).toLocaleDateString('id-ID') : '-'
                    )}
                  </TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingRow(editingRow === row.id ? null : row.id)}
                    >
                      {editingRow === row.id ? 'Selesai' : 'Edit'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
