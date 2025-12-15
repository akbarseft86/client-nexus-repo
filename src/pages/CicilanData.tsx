import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, History, ChevronDown, ChevronUp, Trash2, Search } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useBranch } from "@/contexts/BranchContext";

interface PaymentHistory {
  id: string;
  highticket_id: string;
  tanggal_bayar: string;
  jumlah_bayar: number;
  keterangan: string | null;
  created_at: string;
}

interface HighticketWithPayments {
  id: string;
  client_id: string;
  nama: string;
  nohp: string;
  nama_program: string;
  harga: number;
  status_payment: string;
  nama_ec: string;
  tanggal_transaksi: string;
  keterangan: string | null;
  payments: PaymentHistory[];
  totalPaid: number;
  remaining: number;
  progress: number;
}

export default function CicilanData() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  
  const { getBranchFilter } = useBranch();
  const branchFilter = getBranchFilter();
  
  // Dialog states
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [selectedHighticket, setSelectedHighticket] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({
    tanggal_bayar: new Date().toISOString().split('T')[0],
    jumlah_bayar: "",
    keterangan: "",
  });

  // Fetch highticket data with DP/Angsuran status
  const { data: cicilanData, isLoading } = useQuery({
    queryKey: ["cicilan-data", branchFilter],
    queryFn: async () => {
      // First get client_ids from sh2m_data filtered by branch
      let clientQuery = supabase.from("sh2m_data").select("client_id");
      if (branchFilter) {
        clientQuery = clientQuery.eq("asal_iklan", branchFilter);
      }
      const { data: sh2mClients, error: sh2mError } = await clientQuery;
      if (sh2mError) throw sh2mError;
      
      const clientIds = sh2mClients?.map(c => c.client_id) || [];
      
      // If branch filter is active and no clients found, return empty
      if (branchFilter && clientIds.length === 0) {
        return [];
      }

      let query = supabase
        .from("highticket_data")
        .select("*")
        .in("status_payment", ["DP", "Angsuran"])
        .order("tanggal_transaksi", { ascending: false });
      
      if (branchFilter && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }
      
      const { data: highticketData, error: htError } = await query;
      if (htError) throw htError;

      // Fetch all payment histories
      const highticketIds = highticketData?.map((ht) => ht.id) || [];
      
      let paymentsData: PaymentHistory[] = [];
      if (highticketIds.length > 0) {
        const { data: payments, error: payError } = await supabase
          .from("payment_history")
          .select("*")
          .in("highticket_id", highticketIds)
          .order("tanggal_bayar", { ascending: true });

        if (payError) throw payError;
        paymentsData = (payments || []) as PaymentHistory[];
      }

      // Combine data
      const combinedData: HighticketWithPayments[] = (highticketData || []).map((ht) => {
        const payments = paymentsData.filter((p) => p.highticket_id === ht.id);
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah_bayar), 0);
        const remaining = Number(ht.harga) - totalPaid;
        const progress = (totalPaid / Number(ht.harga)) * 100;

        return {
          ...ht,
          payments,
          totalPaid,
          remaining: remaining > 0 ? remaining : 0,
          progress: progress > 100 ? 100 : progress,
        };
      });

      return combinedData;
    },
  });

  // Add payment mutation
  const addPaymentMutation = useMutation({
    mutationFn: async (payment: {
      highticket_id: string;
      tanggal_bayar: string;
      jumlah_bayar: number;
      keterangan: string | null;
    }) => {
      const { error } = await supabase.from("payment_history").insert([payment]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cicilan-data"] });
      setIsAddPaymentOpen(false);
      setNewPayment({
        tanggal_bayar: new Date().toISOString().split('T')[0],
        jumlah_bayar: "",
        keterangan: "",
      });
      toast({
        title: "Berhasil",
        description: "Pembayaran berhasil ditambahkan",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal menambahkan pembayaran: " + error.message,
        variant: "destructive",
      });
    },
  });

  // Delete payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("payment_history")
        .delete()
        .eq("id", paymentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cicilan-data"] });
      toast({
        title: "Berhasil",
        description: "Pembayaran berhasil dihapus",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Gagal menghapus pembayaran: " + error.message,
        variant: "destructive",
      });
    },
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleAddPayment = () => {
    if (!selectedHighticket || !newPayment.jumlah_bayar) {
      toast({
        title: "Error",
        description: "Mohon lengkapi data pembayaran",
        variant: "destructive",
      });
      return;
    }

    addPaymentMutation.mutate({
      highticket_id: selectedHighticket,
      tanggal_bayar: newPayment.tanggal_bayar,
      jumlah_bayar: Number(newPayment.jumlah_bayar),
      keterangan: newPayment.keterangan || null,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(value);
  };

  // Filter data by search query
  const filteredData = cicilanData?.filter((item) =>
    searchQuery === "" || item.nohp.includes(searchQuery) || item.nama.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Cicilan</h1>
          <p className="text-muted-foreground">
            Tracking pembayaran cicilan client (DP/Angsuran)
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari berdasarkan nama atau nomor HP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Client Cicilan</p>
          <p className="text-2xl font-bold text-foreground">{filteredData?.length || 0}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Tagihan</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(filteredData?.reduce((sum, item) => sum + Number(item.harga), 0) || 0)}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total Terbayar</p>
          <p className="text-2xl font-bold text-green-600">
            {formatCurrency(filteredData?.reduce((sum, item) => sum + item.totalPaid, 0) || 0)}
          </p>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Total Harga</TableHead>
              <TableHead>Terbayar</TableHead>
              <TableHead>Sisa</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData?.map((item) => (
              <Collapsible key={item.id} asChild>
                <>
                  <TableRow className="hover:bg-muted/50">
                    <TableCell>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRow(item.id)}
                        >
                          {expandedRows.has(item.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </TableCell>
                    <TableCell>{item.tanggal_transaksi}</TableCell>
                    <TableCell className="font-mono text-xs">{item.client_id}</TableCell>
                    <TableCell>{item.nama}</TableCell>
                    <TableCell>{item.nohp}</TableCell>
                    <TableCell>{item.nama_program}</TableCell>
                    <TableCell>{formatCurrency(Number(item.harga))}</TableCell>
                    <TableCell className="text-green-600 font-medium">
                      {formatCurrency(item.totalPaid)}
                    </TableCell>
                    <TableCell className="text-orange-600 font-medium">
                      {formatCurrency(item.remaining)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={item.progress} className="w-20 h-2" />
                        <span className="text-xs text-muted-foreground">
                          {item.progress.toFixed(0)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.status_payment === "DP"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {item.status_payment}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Dialog open={isAddPaymentOpen && selectedHighticket === item.id} onOpenChange={(open) => {
                        setIsAddPaymentOpen(open);
                        if (open) setSelectedHighticket(item.id);
                      }}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Plus className="h-4 w-4 mr-1" />
                            Bayar
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Tambah Pembayaran</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="bg-muted p-3 rounded-lg">
                              <p className="text-sm"><strong>Client:</strong> {item.nama}</p>
                              <p className="text-sm"><strong>Program:</strong> {item.nama_program}</p>
                              <p className="text-sm"><strong>Sisa Tagihan:</strong> {formatCurrency(item.remaining)}</p>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Tanggal Bayar</label>
                              <Input
                                type="date"
                                value={newPayment.tanggal_bayar}
                                onChange={(e) =>
                                  setNewPayment({ ...newPayment, tanggal_bayar: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Jumlah Bayar</label>
                              <Input
                                type="number"
                                placeholder="Masukkan jumlah pembayaran"
                                value={newPayment.jumlah_bayar}
                                onChange={(e) =>
                                  setNewPayment({ ...newPayment, jumlah_bayar: e.target.value })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">Keterangan</label>
                              <Input
                                placeholder="Keterangan pembayaran (opsional)"
                                value={newPayment.keterangan}
                                onChange={(e) =>
                                  setNewPayment({ ...newPayment, keterangan: e.target.value })
                                }
                              />
                            </div>
                            <Button onClick={handleAddPayment} className="w-full">
                              Simpan Pembayaran
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(item.id) && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={12} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <History className="h-4 w-4" />
                            Riwayat Pembayaran
                          </div>
                          {item.payments.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Belum ada riwayat pembayaran</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Tanggal</TableHead>
                                  <TableHead>Jumlah</TableHead>
                                  <TableHead>Keterangan</TableHead>
                                  <TableHead>Aksi</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {item.payments.map((payment) => (
                                  <TableRow key={payment.id}>
                                    <TableCell>{payment.tanggal_bayar}</TableCell>
                                    <TableCell className="text-green-600 font-medium">
                                      {formatCurrency(Number(payment.jumlah_bayar))}
                                    </TableCell>
                                    <TableCell>{payment.keterangan || "-"}</TableCell>
                                    <TableCell>
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                          </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Hapus Pembayaran?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Pembayaran sebesar {formatCurrency(Number(payment.jumlah_bayar))} akan dihapus. Tindakan ini tidak dapat dibatalkan.
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Batal</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => deletePaymentMutation.mutate(payment.id)}
                                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                            >
                                              Hapus
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              </Collapsible>
            ))}
            {(!filteredData || filteredData.length === 0) && (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  Tidak ada data cicilan
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
