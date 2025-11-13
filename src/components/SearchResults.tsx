import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Phone, Mail, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchResultsProps {
  searchQuery: string;
  onClientSelect: (clientId: string) => void;
}

const SearchResults = ({ searchQuery, onClientSelect }: SearchResultsProps) => {
  const { data: clients, isLoading } = useQuery({
    queryKey: ["searchClients", searchQuery],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .or(`client_id.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length > 0,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-6">
            <Skeleton className="h-24 w-full" />
          </Card>
        ))}
      </div>
    );
  }

  if (!clients || clients.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Tidak ada client ditemukan dengan pencarian "{searchQuery}"</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground mb-4">
        Ditemukan {clients.length} client
      </p>
      {clients.map((client) => (
        <Card
          key={client.id}
          className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
          onClick={() => onClientSelect(client.id)}
        >
          <div className="flex items-start justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-semibold text-foreground">{client.name}</h3>
                <Badge variant={client.ad_payment_status === "paid" ? "default" : "secondary"}>
                  {client.ad_payment_status === "paid" ? "Paid" : "Unpaid"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-medium text-foreground">{client.client_id}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{client.phone}</span>
                </div>

                {client.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{client.email}</span>
                  </div>
                )}

                {client.purchase_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">
                      {new Date(client.purchase_date).toLocaleDateString("id-ID")}
                    </span>
                  </div>
                )}
              </div>

              {client.ad_product && (
                <div className="pt-2">
                  <p className="text-sm text-muted-foreground">
                    Produk Iklan: <span className="font-medium text-foreground">{client.ad_product}</span>
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
};

export default SearchResults;
