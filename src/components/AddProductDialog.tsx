import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddProductDialog = ({ open, onOpenChange }: AddProductDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    closing_date: "",
    customer_name: "",
    customer_phone: "",
    unique_code: "",
    product_name: "",
    price: "",
    payment_status: "DP",
    ec_name: "",
    days_to_closing: "",
  });

  // Fetch all clients for dropdown
  const { data: clients } = useQuery({
    queryKey: ["allClients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_id, name")
        .order("name");

      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("products").insert([
        {
          client_id: formData.client_id,
          closing_date: formData.closing_date,
          customer_name: formData.customer_name,
          customer_phone: formData.customer_phone,
          unique_code: formData.unique_code,
          product_name: formData.product_name,
          price: parseFloat(formData.price),
          payment_status: formData.payment_status,
          ec_name: formData.ec_name,
          days_to_closing: formData.days_to_closing ? parseInt(formData.days_to_closing) : null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Berhasil!",
        description: "Produk baru telah ditambahkan",
      });

      queryClient.invalidateQueries({ queryKey: ["productsCount"] });
      queryClient.invalidateQueries({ queryKey: ["clientProducts"] });
      onOpenChange(false);
      setFormData({
        client_id: "",
        closing_date: "",
        customer_name: "",
        customer_phone: "",
        unique_code: "",
        product_name: "",
        price: "",
        payment_status: "DP",
        ec_name: "",
        days_to_closing: "",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah Produk Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="client_id">Client *</Label>
            <Select
              value={formData.client_id}
              onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih client" />
              </SelectTrigger>
              <SelectContent>
                {clients?.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.client_id} - {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="closing_date">Tanggal Closing *</Label>
              <Input
                id="closing_date"
                type="date"
                required
                value={formData.closing_date}
                onChange={(e) => setFormData({ ...formData, closing_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_name">Nama Customer *</Label>
              <Input
                id="customer_name"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Nama customer"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer_phone">No HP Customer *</Label>
              <Input
                id="customer_phone"
                required
                value={formData.customer_phone}
                onChange={(e) => setFormData({ ...formData, customer_phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="unique_code">Kode Unik *</Label>
              <Input
                id="unique_code"
                required
                value={formData.unique_code}
                onChange={(e) => setFormData({ ...formData, unique_code: e.target.value })}
                placeholder="Contoh: PRD001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_name">Nama Produk *</Label>
              <Input
                id="product_name"
                required
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="Nama produk"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Harga *</Label>
              <Input
                id="price"
                type="number"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_status">Status Payment *</Label>
              <Select
                value={formData.payment_status}
                onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="Lunas">Lunas</SelectItem>
                  <SelectItem value="Pelunasan">Pelunasan</SelectItem>
                  <SelectItem value="Angsuran">Angsuran</SelectItem>
                  <SelectItem value="Cicilan">Cicilan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ec_name">Nama EC *</Label>
              <Input
                id="ec_name"
                required
                value={formData.ec_name}
                onChange={(e) => setFormData({ ...formData, ec_name: e.target.value })}
                placeholder="Nama Executive Consultant"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="days_to_closing">Hari ke Closing</Label>
              <Input
                id="days_to_closing"
                type="number"
                value={formData.days_to_closing}
                onChange={(e) => setFormData({ ...formData, days_to_closing: e.target.value })}
                placeholder="Jumlah hari dari iklan ke closing"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Produk"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductDialog;
