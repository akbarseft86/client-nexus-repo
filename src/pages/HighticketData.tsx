import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { toast } from "sonner";
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

export default function HighticketData() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchClientId, setSearchClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  
  const queryClient = useQueryClient();

  const { data: highticketData, isLoading } = useQuery({
    queryKey: ["highticket-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("highticket_data")
        .select("*")
        .order("tanggal_transaksi", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["sh2m-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sh2m_data")
        .select("client_id, nama_client, nohp_client")
        .order("nama_client");
      
      if (error) throw error;
      return data;
    },
  });

  const searchClient = async (searchTerm: string) => {
    // Try to search by client_id first
    let { data, error } = await supabase
      .from("sh2m_data")
      .select("*")
      .eq("client_id", searchTerm)
      .maybeSingle();
    
    // If not found, try searching by phone number
    if (!data && searchTerm) {
      const { data: phoneData, error: phoneError } = await supabase
        .from("sh2m_data")
        .select("*")
        .eq("nohp_client", searchTerm)
        .maybeSingle();
      
      data = phoneData;
      error = phoneError;
    }
    
    if (error || !data) {
      toast.error("Client tidak ditemukan");
      setSelectedClient(null);
      return;
    }
    
    setSelectedClient(data);
    toast.success("Client ditemukan");
  };

  const addMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const newData = {
        tanggal_transaksi: formData.get("tanggal_transaksi") as string,
        client_id: formData.get("client_id") as string,
        nama: formData.get("nama") as string,
        nohp: formData.get("nohp") as string,
        category: formData.get("category") as string,
        nama_program: formData.get("nama_program") as string,
        harga: parseFloat(formData.get("harga") as string),
        status_payment: formData.get("status_payment") as string,
        nama_ec: formData.get("nama_ec") as string,
        tanggal_sh2m: formData.get("tanggal_sh2m") as string || null,
        pelaksanaan_program: formData.get("pelaksanaan_program") as string,
        keterangan: formData.get("keterangan") as string,
      };

      const { error } = await supabase.from("highticket_data").insert(newData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
      toast.success("Data berhasil ditambahkan");
      setDialogOpen(false);
      setSelectedClient(null);
      setSearchClientId("");
    },
    onError: () => {
      toast.error("Gagal menambahkan data");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Data Client Highticket</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Data
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Data Client Highticket</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="search-client">Cari Client ID atau No HP</Label>
                  <Input
                    id="search-client"
                    placeholder="Masukkan Client ID atau No HP"
                    value={searchClientId}
                    onChange={(e) => setSearchClientId(e.target.value)}
                  />
                </div>
                <Button
                  className="mt-auto"
                  onClick={() => searchClient(searchClientId)}
                >
                  Cari
                </Button>
              </div>

              {selectedClient && (
                <Card className="p-4 bg-muted">
                  <p className="text-sm"><strong>Nama:</strong> {selectedClient.nama_client}</p>
                  <p className="text-sm"><strong>No HP:</strong> {selectedClient.nohp_client}</p>
                  <p className="text-sm"><strong>Client ID:</strong> {selectedClient.client_id}</p>
                </Card>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate(new FormData(e.currentTarget));
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal_transaksi">Tanggal Transaksi</Label>
                    <Input id="tanggal_transaksi" name="tanggal_transaksi" type="date" required />
                  </div>
                  <div>
                    <Label htmlFor="client_id">Client ID</Label>
                    <Input 
                      id="client_id" 
                      name="client_id" 
                      value={selectedClient?.client_id || ''} 
                      onChange={(e) => {
                        if (selectedClient) {
                          setSelectedClient({ ...selectedClient, client_id: e.target.value });
                        }
                      }}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="nama">Nama</Label>
                    <Input 
                      id="nama" 
                      name="nama" 
                      defaultValue={selectedClient?.nama_client || ''} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="nohp">No HP</Label>
                    <Input 
                      id="nohp" 
                      name="nohp" 
                      defaultValue={selectedClient?.nohp_client || ''} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select name="category" defaultValue="Program" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Program">Program</SelectItem>
                        <SelectItem value="Merchandise">Merchandise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nama_program">Nama Program</Label>
                    <Input id="nama_program" name="nama_program" required />
                  </div>
                  <div>
                    <Label htmlFor="harga">Harga</Label>
                    <Input id="harga" name="harga" type="number" required />
                  </div>
                  <div>
                    <Label htmlFor="status_payment">Status Payment</Label>
                    <Select name="status_payment" defaultValue="Lunas" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lunas">Lunas</SelectItem>
                        <SelectItem value="DP">DP</SelectItem>
                        <SelectItem value="Angsuran">Angsuran</SelectItem>
                        <SelectItem value="Pelunasan">Pelunasan</SelectItem>
                        <SelectItem value="Bonus">Bonus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nama_ec">Nama EC</Label>
                    <Input id="nama_ec" name="nama_ec" required />
                  </div>
                  <div>
                    <Label htmlFor="tanggal_sh2m">Tanggal SH2M</Label>
                    <Input id="tanggal_sh2m" name="tanggal_sh2m" type="date" />
                  </div>
                  <div>
                    <Label htmlFor="pelaksanaan_program">Pelaksanaan Program</Label>
                    <Input id="pelaksanaan_program" name="pelaksanaan_program" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="keterangan">Keterangan</Label>
                    <Input id="keterangan" name="keterangan" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                </Button>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal Transaksi</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Nama Program</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Status Payment</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Tanggal SH2M</TableHead>
              <TableHead>Pelaksanaan Program</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : highticketData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              highticketData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.tanggal_transaksi).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.nohp}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.category === 'Program' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {row.category}
                    </span>
                  </TableCell>
                  <TableCell>{row.nama_program}</TableCell>
                  <TableCell>Rp {row.harga.toLocaleString('id-ID')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status_payment === 'Lunas' 
                        ? 'bg-success/10 text-success' 
                        : row.status_payment === 'DP' || row.status_payment === 'Angsuran'
                        ? 'bg-warning/10 text-warning'
                        : row.status_payment === 'Pelunasan'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.status_payment}
                    </span>
                  </TableCell>
                  <TableCell>{row.nama_ec}</TableCell>
                  <TableCell>
                    {row.tanggal_sh2m ? new Date(row.tanggal_sh2m).toLocaleDateString('id-ID') : '-'}
                  </TableCell>
                  <TableCell>{row.pelaksanaan_program}</TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
