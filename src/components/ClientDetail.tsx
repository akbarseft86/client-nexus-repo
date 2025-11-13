import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, User, Phone, Mail, Calendar, FileText, DollarSign, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
}

const ClientDetail = ({ clientId, onBack }: ClientDetailProps) => {
  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["clientProducts", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("client_id", clientId)
        .order("closing_date", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "Lunas":
        return "bg-success/10 text-success border-success/20";
      case "DP":
        return "bg-warning/10 text-warning border-warning/20";
      case "Pelunasan":
      case "Angsuran":
      case "Cicilan":
        return "bg-info/10 text-info border-info/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (clientLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-32" />
        <Card className="p-6">
          <Skeleton className="h-64 w-full" />
        </Card>
      </div>
    );
  }

  if (!client) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Client tidak ditemukan</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button onClick={onBack} variant="outline" className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Kembali ke Pencarian
      </Button>

      {/* Client Information */}
      <Card className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{client.name}</h2>
            <Badge variant={client.ad_payment_status === "paid" ? "default" : "secondary"} className="text-sm">
              Iklan: {client.ad_payment_status === "paid" ? "Paid" : "Unpaid"}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">ID Client</p>
                <p className="font-semibold text-foreground">{client.client_id}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">No HP</p>
                <p className="font-semibold text-foreground">{client.phone}</p>
              </div>
            </div>

            {client.email && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-info" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-semibold text-foreground">{client.email}</p>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {client.purchase_date && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-warning/10 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tanggal Pembelian</p>
                  <p className="font-semibold text-foreground">
                    {new Date(client.purchase_date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}

            {client.ec_name && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nama EC</p>
                  <p className="font-semibold text-foreground">{client.ec_name}</p>
                </div>
              </div>
            )}

            {client.ad_product && (
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Produk Iklan</p>
                  <p className="font-semibold text-foreground">{client.ad_product}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {client.paid_description && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <div className="flex items-start gap-3">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground mb-1">Keterangan Paid</p>
                <p className="text-sm text-foreground">{client.paid_description}</p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Products History */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-accent" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Riwayat Produk</h3>
            <p className="text-sm text-muted-foreground">
              Total {products?.length || 0} produk terjual
            </p>
          </div>
        </div>

        {productsLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : products && products.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal Closing</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode Unik</TableHead>
                  <TableHead>Produk</TableHead>
                  <TableHead className="text-right">Harga</TableHead>
                  <TableHead>Status Payment</TableHead>
                  <TableHead>EC</TableHead>
                  <TableHead className="text-right">Hari ke Closing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      {new Date(product.closing_date).toLocaleDateString("id-ID")}
                    </TableCell>
                    <TableCell className="font-medium">{product.customer_name}</TableCell>
                    <TableCell>
                      <code className="px-2 py-1 bg-muted rounded text-xs">
                        {product.unique_code}
                      </code>
                    </TableCell>
                    <TableCell>{product.product_name}</TableCell>
                    <TableCell className="text-right font-semibold">
                      Rp {product.price.toLocaleString("id-ID")}
                    </TableCell>
                    <TableCell>
                      <Badge className={getPaymentStatusColor(product.payment_status)}>
                        {product.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>{product.ec_name}</TableCell>
                    <TableCell className="text-right">
                      {product.days_to_closing ? (
                        <span className="text-muted-foreground">
                          {product.days_to_closing} hari
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Belum ada produk terjual</p>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ClientDetail;
