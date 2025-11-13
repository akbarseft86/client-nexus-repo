import { useState } from "react";
import { Search, Plus, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import SearchResults from "@/components/SearchResults";
import ClientDetail from "@/components/ClientDetail";
import AddClientDialog from "@/components/AddClientDialog";
import AddProductDialog from "@/components/AddProductDialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);

  // Fetch total clients count
  const { data: clientsCount } = useQuery({
    queryKey: ["clientsCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("clients")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  // Fetch total products count
  const { data: productsCount } = useQuery({
    queryKey: ["productsCount"],
    queryFn: async () => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setSelectedClientId(null);
  };

  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSearchQuery("");
  };

  const handleBack = () => {
    setSelectedClientId(null);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Client Management System</h1>
              <p className="text-sm text-muted-foreground">Kelola data client dan produk dengan mudah</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setShowAddProduct(true)} variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Produk
              </Button>
              <Button onClick={() => setShowAddClient(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Tambah Client
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Clients</p>
                <p className="text-3xl font-bold text-foreground mt-1">{clientsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Produk</p>
                <p className="text-3xl font-bold text-foreground mt-1">{productsCount}</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-accent" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Sistem Aktif</p>
                <p className="text-lg font-semibold text-foreground mt-1">CRM Dashboard</p>
              </div>
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                <div className="h-3 w-3 rounded-full bg-success animate-pulse" />
              </div>
            </div>
          </Card>
        </div>

        {/* Search Bar */}
        {!selectedClientId && (
          <Card className="p-6 mb-8">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari client berdasarkan ID Client atau No HP..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 h-12 text-base"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Tip: Ketik ID Client atau nomor HP untuk mencari data client lengkap
            </p>
          </Card>
        )}

        {/* Content Area */}
        {selectedClientId ? (
          <ClientDetail clientId={selectedClientId} onBack={handleBack} />
        ) : searchQuery ? (
          <SearchResults searchQuery={searchQuery} onClientSelect={handleClientSelect} />
        ) : (
          <Card className="p-12 text-center">
            <Search className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-foreground mb-2">Mulai Pencarian</h3>
            <p className="text-muted-foreground">
              Masukkan ID Client atau No HP untuk melihat data lengkap client
            </p>
          </Card>
        )}
      </div>

      <AddClientDialog open={showAddClient} onOpenChange={setShowAddClient} />
      <AddProductDialog open={showAddProduct} onOpenChange={setShowAddProduct} />
    </div>
  );
};

export default Index;
