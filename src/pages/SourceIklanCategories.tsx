import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Check, X } from "lucide-react";

export default function SourceIklanCategories() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const queryClient = useQueryClient();

  // Get unique source_iklan from sh2m_data
  const { data: uniqueSourceIklan, isLoading: loadingUnique } = useQuery({
    queryKey: ["unique-source-iklan"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sh2m_data")
        .select("source_iklan")
        .order("source_iklan");
      
      if (error) throw error;
      
      // Get unique values
      const unique = [...new Set(data.map(item => item.source_iklan))];
      return unique;
    },
  });

  // Get existing categories
  const { data: categories, isLoading: loadingCategories } = useQuery({
    queryKey: ["source-iklan-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_iklan_categories")
        .select("*")
        .order("source_iklan");
      
      if (error) throw error;
      return data;
    },
  });

  // Sync unique source_iklan with categories table
  useEffect(() => {
    if (uniqueSourceIklan && categories) {
      const existingSourceIklan = categories.map(c => c.source_iklan);
      const missingSourceIklan = uniqueSourceIklan.filter(
        source => !existingSourceIklan.includes(source)
      );

      if (missingSourceIklan.length > 0) {
        // Insert missing source_iklan
        missingSourceIklan.forEach(async (source) => {
          await supabase
            .from("source_iklan_categories")
            .insert({ source_iklan: source, kategori: null });
        });
        queryClient.invalidateQueries({ queryKey: ["source-iklan-categories"] });
      }
    }
  }, [uniqueSourceIklan, categories, queryClient]);

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
      setEditingId(null);
      setEditValue("");
    },
    onError: () => {
      toast.error("Gagal memperbarui kategori");
    },
  });

  const handleEdit = (id: string, currentKategori: string | null) => {
    setEditingId(id);
    setEditValue(currentKategori || "");
  };

  const handleSave = (id: string) => {
    updateCategoryMutation.mutate({ id, kategori: editValue });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue("");
  };

  const isLoading = loadingUnique || loadingCategories;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Kategori Source Iklan</h1>
          <p className="text-muted-foreground mt-1">
            Kelola kategori untuk setiap source iklan
          </p>
        </div>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50%]">Source Iklan</TableHead>
              <TableHead className="w-[40%]">Kategori</TableHead>
              <TableHead className="w-[10%] text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : categories?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              categories?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.source_iklan}</TableCell>
                  <TableCell>
                    {editingId === row.id ? (
                      <Input
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Masukkan kategori"
                        className="max-w-md"
                        autoFocus
                      />
                    ) : (
                      <div 
                        className="cursor-pointer hover:bg-muted px-2 py-1 rounded"
                        onClick={() => handleEdit(row.id, row.kategori)}
                      >
                        {row.kategori || <span className="text-muted-foreground italic">Klik untuk menambah kategori</span>}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingId === row.id ? (
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleSave(row.id)}
                          disabled={updateCategoryMutation.isPending}
                        >
                          <Check className="h-4 w-4 text-success" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleCancel}
                          disabled={updateCategoryMutation.isPending}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(row.id, row.kategori)}
                      >
                        Edit
                      </Button>
                    )}
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
