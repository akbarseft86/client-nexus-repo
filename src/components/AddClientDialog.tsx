import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddClientDialog = ({ open, onOpenChange }: AddClientDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    client_id: "",
    name: "",
    phone: "",
    email: "",
    ad_product: "",
    purchase_date: "",
    ec_name: "",
    paid_description: "",
    ad_payment_status: "unpaid",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("clients").insert([
        {
          ...formData,
          purchase_date: formData.purchase_date || null,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Berhasil!",
        description: "Client baru telah ditambahkan",
      });

      queryClient.invalidateQueries({ queryKey: ["clientsCount"] });
      onOpenChange(false);
      setFormData({
        client_id: "",
        name: "",
        phone: "",
        email: "",
        ad_product: "",
        purchase_date: "",
        ec_name: "",
        paid_description: "",
        ad_payment_status: "unpaid",
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
          <DialogTitle>Tambah Client Baru</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="client_id">ID Client *</Label>
              <Input
                id="client_id"
                required
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
                placeholder="Contoh: CL001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama *</Label>
              <Input
                id="name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nama lengkap client"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">No HP *</Label>
              <Input
                id="phone"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad_product">Produk Iklan</Label>
              <Input
                id="ad_product"
                value={formData.ad_product}
                onChange={(e) => setFormData({ ...formData, ad_product: e.target.value })}
                placeholder="Nama produk iklan"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_date">Tanggal Pembelian</Label>
              <Input
                id="purchase_date"
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ec_name">Nama EC</Label>
              <Input
                id="ec_name"
                value={formData.ec_name}
                onChange={(e) => setFormData({ ...formData, ec_name: e.target.value })}
                placeholder="Nama Executive Consultant"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad_payment_status">Status Payment Iklan</Label>
              <Select
                value={formData.ad_payment_status}
                onValueChange={(value) => setFormData({ ...formData, ad_payment_status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="paid_description">Keterangan Paid</Label>
            <Textarea
              id="paid_description"
              value={formData.paid_description}
              onChange={(e) => setFormData({ ...formData, paid_description: e.target.value })}
              placeholder="Catatan atau keterangan tambahan tentang pembayaran"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Client"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;
