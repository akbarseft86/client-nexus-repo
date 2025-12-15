import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useBranch } from "@/contexts/BranchContext";

export default function SearchClient() {
  const [searchQuery, setSearchQuery] = useState("");
  const { getBranchFilter } = useBranch();
  const branchFilter = getBranchFilter();

  const { data: sh2mResults } = useQuery({
    queryKey: ["search-sh2m", searchQuery, branchFilter],
    queryFn: async () => {
      if (!searchQuery) return [];
      
      let query = supabase
        .from("sh2m_data")
        .select("*")
        .or(`client_id.ilike.%${searchQuery}%,nama_client.ilike.%${searchQuery}%,nohp_client.ilike.%${searchQuery}%`);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length > 0,
  });

  const { data: highticketResults } = useQuery({
    queryKey: ["search-highticket", searchQuery, branchFilter],
    queryFn: async () => {
      if (!searchQuery || !sh2mResults || sh2mResults.length === 0) return [];
      
      const clientIds = sh2mResults.map(r => r.client_id);
      
      const { data, error } = await supabase
        .from("highticket_data")
        .select("*")
        .in("client_id", clientIds);
      
      if (error) throw error;
      return data;
    },
    enabled: searchQuery.length > 0 && (sh2mResults?.length ?? 0) > 0,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Pencarian Client</h1>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Search className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            <Label htmlFor="search">Cari berdasarkan Client ID, Nama, atau No HP</Label>
            <Input
              id="search"
              placeholder="Masukkan Client ID, Nama, atau No HP"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="mt-2"
            />
          </div>
        </div>
      </Card>

      {searchQuery && sh2mResults && sh2mResults.length > 0 && (
        <>
          <div>
            <h2 className="text-2xl font-semibold mb-4">Data SH2M</h2>
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>No HP</TableHead>
                    <TableHead>Source Iklan</TableHead>
                    <TableHead>Asal Iklan</TableHead>
                    <TableHead>Nama EC</TableHead>
                    <TableHead>Status Payment</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sh2mResults.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.client_id}</TableCell>
                      <TableCell>{new Date(row.tanggal).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell>{row.nama_client}</TableCell>
                      <TableCell>{row.nohp_client}</TableCell>
                      <TableCell>{row.source_iklan}</TableCell>
                      <TableCell>{row.asal_iklan}</TableCell>
                      <TableCell>{row.nama_ec}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded text-xs ${
                          row.status_payment === 'paid' 
                            ? 'bg-success/10 text-success' 
                            : 'bg-warning/10 text-warning'
                        }`}>
                          {row.status_payment}
                        </span>
                      </TableCell>
                      <TableCell>{row.keterangan}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Riwayat Pembelian Program (Highticket)</h2>
            <Card>
              {highticketResults && highticketResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal Transaksi</TableHead>
                      <TableHead>Client ID</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Nama Program</TableHead>
                      <TableHead>Harga</TableHead>
                      <TableHead>Status Payment</TableHead>
                      <TableHead>Nama EC</TableHead>
                      <TableHead>Pelaksanaan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {highticketResults.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{new Date(row.tanggal_transaksi).toLocaleDateString('id-ID')}</TableCell>
                        <TableCell className="font-medium">{row.client_id}</TableCell>
                        <TableCell>{row.nama}</TableCell>
                        <TableCell>{row.nama_program}</TableCell>
                        <TableCell>Rp {row.harga.toLocaleString('id-ID')}</TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 rounded text-xs ${
                            row.status_payment === 'paid' 
                              ? 'bg-success/10 text-success' 
                              : 'bg-warning/10 text-warning'
                          }`}>
                            {row.status_payment}
                          </span>
                        </TableCell>
                        <TableCell>{row.nama_ec}</TableCell>
                        <TableCell>{row.pelaksanaan_program}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  Client ini belum membeli program highticket
                </div>
              )}
            </Card>
          </div>
        </>
      )}

      {searchQuery && sh2mResults && sh2mResults.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          Tidak ada hasil yang ditemukan
        </Card>
      )}

      {!searchQuery && (
        <Card className="p-8 text-center text-muted-foreground">
          Masukkan Client ID, nama, atau nomor HP untuk mencari
        </Card>
      )}
    </div>
  );
}
