import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { useBranch } from "@/contexts/BranchContext";

export default function SourceIklanCategories() {
  const queryClient = useQueryClient();
  const { selectedBranch, getBranchFilter } = useBranch();
  const branchFilter = getBranchFilter();

  // Get unique source_iklan from sh2m_data filtered by branch
  const { data: uniqueSourceIklan, isLoading: loadingUnique } = useQuery({
    queryKey: ["unique-source-iklan", selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from("sh2m_data")
        .select("source_iklan")
        .order("source_iklan");
      
      // Filter by branch - use selectedBranch to determine the correct asal_iklan value
      if (selectedBranch === "SEFT Bekasi") {
        query = query.eq("asal_iklan", "SEFT Corp - Bekasi");
      } else if (selectedBranch === "SEFT Jogja") {
        query = query.eq("asal_iklan", "SEFT Corp - Jogja");
      }
      // If SEFT ALL, don't filter - show all source_iklan
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Get unique values
      const unique = [...new Set(data.map(item => item.source_iklan))];
      return unique;
    },
  });

  // Get existing categories
  const { data: categories, isLoading: loadingCategories, refetch: refetchCategories } = useQuery({
    queryKey: ["source-iklan-categories", selectedBranch],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_iklan_categories")
        .select("*")
        .order("source_iklan");
      
      if (error) throw error;
      return data;
    },
  });

  // Filter categories to only show ones that exist in the current branch's SH2M data
  const filteredCategories = categories?.filter(
    cat => uniqueSourceIklan?.includes(cat.source_iklan)
  );

  // Sync unique source_iklan with categories table
  useEffect(() => {
    const syncCategories = async () => {
      if (uniqueSourceIklan && categories) {
        const existingSourceIklan = categories.map(c => c.source_iklan);
        const missingSourceIklan = uniqueSourceIklan.filter(
          source => !existingSourceIklan.includes(source)
        );

        if (missingSourceIklan.length > 0) {
          // Insert all missing source_iklan at once
          const insertData = missingSourceIklan.map(source => ({
            source_iklan: source,
            kategori: null
          }));
          
          await supabase
            .from("source_iklan_categories")
            .upsert(insertData, { onConflict: 'source_iklan', ignoreDuplicates: true });
          
          // Refetch categories after inserting
          refetchCategories();
        }
      }
    };
    
    syncCategories();
  }, [uniqueSourceIklan, categories, refetchCategories]);

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, kategori }: { id: string; kategori: string }) => {
      const { error } = await supabase
        .from("source_iklan_categories")
        .update({ kategori })
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source-iklan-categories"] });
      toast.success("Kategori berhasil diperbarui");
    },
    onError: () => {
      toast.error("Gagal memperbarui kategori");
    },
  });

  const handleCategoryChange = (id: string, kategori: string) => {
    updateCategoryMutation.mutate({ id, kategori });
  };

  const isLoading = loadingUnique || loadingCategories;

  const getBranchName = () => {
    if (selectedBranch === "SEFT Bekasi") return "Bekasi";
    if (selectedBranch === "SEFT Jogja") return "Jogja";
    return "Semua Cabang";
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Kategori Source Iklan</h1>
          <p className="text-muted-foreground mt-1">
            Kelola kategori untuk setiap source iklan - Data dari cabang {getBranchName()}
          </p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">Source Iklan</TableHead>
              <TableHead className="w-[40%]">Kategori</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredCategories?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={2} className="text-center">
                  Tidak ada data source iklan untuk cabang {getBranchName()}
                </TableCell>
              </TableRow>
            ) : (
              filteredCategories?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.source_iklan}</TableCell>
                  <TableCell>
                    <Select
                      value={row.kategori || ""}
                      onValueChange={(value) => handleCategoryChange(row.id, value)}
                    >
                      <SelectTrigger className="w-40 bg-popover">
                        <SelectValue placeholder="Pilih kategori" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="Abundance">Abundance</SelectItem>
                        <SelectItem value="Healing">Healing</SelectItem>
                      </SelectContent>
                    </Select>
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
