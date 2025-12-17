import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const CS_NAMES = ["Farah", "Intan", "Rizki", "Sefhia", "Yola"];

interface SH2MRevenueData {
  id: string;
  tanggal: string;
  nama_cs: string;
  jumlah_leads: number;
  closing: number;
  omset: number;
  keterangan: string | null;
  asal_iklan: string;
}

export default function SH2MRevenue() {
  const { selectedBranch, getBranchFilter } = useBranch();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingData, setEditingData] = useState<SH2MRevenueData | null>(null);
  
  const [formData, setFormData] = useState({
    tanggal: "",
    nama_cs: "",
    jumlah_leads: 0,
    closing: 0,
    omset: 0,
    keterangan: "",
  });

  const branchFilter = getBranchFilter();

  const { data: revenueData, isLoading } = useQuery({
    queryKey: ["sh2m-revenue", branchFilter],
    queryFn: async () => {
      let query = supabase
        .from("sh2m_revenue")
        .select("*")
        .order("tanggal", { ascending: false });

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
        tanggal: data.tanggal,
        nama_cs: data.nama_cs,
        jumlah_leads: data.jumlah_leads,
        closing: data.closing,
        omset: data.omset,
        keterangan: data.keterangan || null,
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
          tanggal: data.tanggal,
          nama_cs: data.nama_cs,
          jumlah_leads: data.jumlah_leads,
          closing: data.closing,
          omset: data.omset,
          keterangan: data.keterangan,
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
      tanggal: "",
      nama_cs: "",
      jumlah_leads: 0,
      closing: 0,
      omset: 0,
      keterangan: "",
    });
  };

  const handleAdd = () => {
    if (!formData.tanggal || !formData.nama_cs) {
      toast.error("Tanggal dan Nama CS wajib diisi");
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

  const calculateClosingRate = (leads: number, closing: number) => {
    if (leads === 0) return "0%";
    return ((closing / leads) * 100).toFixed(1) + "%";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMMM yyyy", { locale: idLocale });
    } catch {
      return dateStr;
    }
  };

  // Summary calculations
  const totalLeads = revenueData?.reduce((sum, d) => sum + d.jumlah_leads, 0) || 0;
  const totalClosing = revenueData?.reduce((sum, d) => sum + d.closing, 0) || 0;
  const totalOmset = revenueData?.reduce((sum, d) => sum + Number(d.omset), 0) || 0;
  const avgClosingRate = totalLeads > 0 ? ((totalClosing / totalLeads) * 100).toFixed(1) : "0";

  if (isLoading) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Data Revenue SH2M - {selectedBranch}</h1>
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
                <Label>Tanggal *</Label>
                <Input
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                />
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
                <Label>Jumlah Leads</Label>
                <Input
                  type="number"
                  value={formData.jumlah_leads}
                  onChange={(e) => setFormData({ ...formData, jumlah_leads: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Closing</Label>
                <Input
                  type="number"
                  value={formData.closing}
                  onChange={(e) => setFormData({ ...formData, closing: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Closing Rate</Label>
                <Input
                  value={calculateClosingRate(formData.jumlah_leads, formData.closing)}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Omset</Label>
                <Input
                  type="number"
                  value={formData.omset}
                  onChange={(e) => setFormData({ ...formData, omset: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Keterangan</Label>
                <Textarea
                  value={formData.keterangan}
                  onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })}
                />
              </div>
              <Button onClick={handleAdd} className="w-full" disabled={addMutation.isPending}>
                {addMutation.isPending ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalLeads.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Closing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalClosing.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Avg Closing Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{avgClosingRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Omset</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{formatCurrency(totalOmset)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Nama CS</TableHead>
                <TableHead className="text-right">Jumlah Leads</TableHead>
                <TableHead className="text-right">Closing</TableHead>
                <TableHead className="text-right">Closing Rate</TableHead>
                <TableHead className="text-right">Omset</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revenueData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.tanggal)}</TableCell>
                  <TableCell>{row.nama_cs}</TableCell>
                  <TableCell className="text-right">{row.jumlah_leads.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{row.closing.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{calculateClosingRate(row.jumlah_leads, row.closing)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(row.omset))}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.keterangan || "-"}</TableCell>
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
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                <Label>Tanggal *</Label>
                <Input
                  type="date"
                  value={editingData.tanggal}
                  onChange={(e) => setEditingData({ ...editingData, tanggal: e.target.value })}
                />
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
                <Label>Jumlah Leads</Label>
                <Input
                  type="number"
                  value={editingData.jumlah_leads}
                  onChange={(e) => setEditingData({ ...editingData, jumlah_leads: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Closing</Label>
                <Input
                  type="number"
                  value={editingData.closing}
                  onChange={(e) => setEditingData({ ...editingData, closing: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Closing Rate</Label>
                <Input
                  value={calculateClosingRate(editingData.jumlah_leads, editingData.closing)}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Omset</Label>
                <Input
                  type="number"
                  value={editingData.omset}
                  onChange={(e) => setEditingData({ ...editingData, omset: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Keterangan</Label>
                <Textarea
                  value={editingData.keterangan || ""}
                  onChange={(e) => setEditingData({ ...editingData, keterangan: e.target.value })}
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
