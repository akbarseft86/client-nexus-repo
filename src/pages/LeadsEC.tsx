import { useQuery } from "@tanstack/react-query";
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

const LeadsEC = () => {
  const { data: leadsData, isLoading } = useQuery({
    queryKey: ["leads-ec"],
    queryFn: async () => {
      // Fetch paid SH2M data
      const { data: sh2mRows, error: sh2mError } = await supabase
        .from("sh2m_data")
        .select("*")
        .eq("status_payment", "paid")
        .order("tanggal", { ascending: false })
        .order("jam", { ascending: false });
      
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Leads EC</h1>
        <p className="text-muted-foreground mt-2">
          Data client closing iklan dengan status payment: Paid
        </p>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Nama Client</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Source Iklan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Asal Iklan</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Tanggal Update Paid</TableHead>
              <TableHead>Keterangan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : leadsData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              leadsData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>
                    {row.tanggal ? format(new Date(row.tanggal), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell>{row.jam || "-"}</TableCell>
                  <TableCell>{row.nama_client}</TableCell>
                  <TableCell>{row.nohp_client}</TableCell>
                  <TableCell>{row.source_iklan}</TableCell>
                  <TableCell>{row.kategori}</TableCell>
                  <TableCell>{row.asal_iklan}</TableCell>
                  <TableCell>{row.nama_ec || "-"}</TableCell>
                  <TableCell>
                    {row.tanggal_update_paid 
                      ? format(new Date(row.tanggal_update_paid), "dd/MM/yyyy")
                      : "-"
                    }
                  </TableCell>
                  <TableCell>{row.keterangan || "-"}</TableCell>
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
