import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CalendarIcon, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useBranch } from "@/contexts/BranchContext";

const LeadsEC = () => {
  const queryClient = useQueryClient();
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { getBranchFilter } = useBranch();
  const branchFilter = getBranchFilter();

  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads-ec", branchFilter],
    queryFn: async () => {
      // Fetch paid SH2M data
      let query = supabase
        .from("sh2m_data")
        .select("*")
        .eq("status_payment", "paid")
        .order("tanggal", { ascending: false })
        .order("jam", { ascending: false });
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data: sh2mRows, error: sh2mError } = await query;
      if (sh2mError) throw sh2mError;
      
      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from("source_iklan_categories")
        .select("source_iklan, kategori");
      
      if (catError) throw catError;
      
      // Create a map of source_iklan to kategori
      const categoryMap = new Map(
        categories?.map(cat => [cat.source_iklan, cat.kategori]) || []
      );
      
      // Merge data
      return sh2mRows?.map(row => ({
        ...row,
        kategori: categoryMap.get(row.source_iklan) || '-'
      }));
    },
  });

  // Filter data based on search query
  const filteredData = leadsData?.filter((row) =>
    searchQuery === "" || row.nohp_client?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDateChange = async (rowId: string, newDate: Date | undefined) => {
    if (!newDate) return;
    
    try {
      const formattedDate = format(newDate, "yyyy-MM-dd");
      
      // Optimistic update - update cache directly without refetching
      queryClient.setQueryData(["leads-ec"], (oldData: any) => {
        if (!oldData) return oldData;
        return oldData.map((row: any) => 
          row.id === rowId 
            ? { ...row, tanggal_share: formattedDate }
            : row
        );
      });

      const { error } = await supabase
        .from("sh2m_data")
        .update({ tanggal_share: formattedDate })
        .eq("id", rowId);

      if (error) throw error;

      toast.success("Tanggal Share berhasil diupdate");
      setEditingRow(null);
      setEditingDate(undefined);
    } catch (error) {
      console.error("Error updating tanggal share:", error);
      toast.error("Gagal mengupdate tanggal share");
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ["leads-ec"] });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads EC</h1>
        <p className="text-muted-foreground mt-2">
          Data client closing iklan dengan status payment: Paid
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Cari berdasarkan nomor HP..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Nama Client</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Asal Iklan</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Tanggal Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              filteredData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>
                    {row.tanggal ? format(new Date(row.tanggal), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell>{row.nama_client}</TableCell>
                  <TableCell>{row.nohp_client}</TableCell>
                  <TableCell>{row.kategori}</TableCell>
                  <TableCell>{row.asal_iklan}</TableCell>
                  <TableCell>{row.nama_ec || "-"}</TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-[200px] justify-start text-left font-normal",
                              !editingDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {editingDate ? format(editingDate, "dd/MM/yyyy") : "Pilih tanggal"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={editingDate}
                            onSelect={(date) => {
                              setEditingDate(date);
                              handleDateChange(row.id, date);
                            }}
                            initialFocus
                            className="pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingRow(row.id);
                          setEditingDate(row.tanggal_share ? new Date(row.tanggal_share) : undefined);
                        }}
                        className="text-left hover:underline"
                      >
                        {row.tanggal_share 
                          ? format(new Date(row.tanggal_share), "dd/MM/yyyy")
                          : "-"
                        }
                      </button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default LeadsEC;
