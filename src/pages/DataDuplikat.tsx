import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Search, AlertTriangle } from "lucide-react";
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
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface DuplicateGroup {
  key: string;
  records: any[];
  branches: string[];
}

export default function DataDuplikat() {
  const [searchTerm, setSearchTerm] = useState("");
  const [duplicateType, setDuplicateType] = useState<"phone" | "name">("phone");

  // Fetch all SH2M data from both branches
  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["sh2m-all-data"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sh2m_data")
        .select("*")
        .order("tanggal", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Find duplicates
  const duplicateGroups: DuplicateGroup[] = (() => {
    if (!sh2mData) return [];

    const groups: Record<string, any[]> = {};
    
    sh2mData.forEach((record) => {
      const key = duplicateType === "phone" 
        ? record.nohp_client?.toString().trim() 
        : record.nama_client?.toLowerCase().trim();
      
      if (key) {
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(record);
      }
    });

    // Filter to only show groups with records from BOTH branches
    return Object.entries(groups)
      .filter(([_, records]) => {
        const branches = new Set(records.map(r => r.asal_iklan));
        const hasBekasi = Array.from(branches).some(b => b?.includes("Bekasi"));
        const hasJogja = Array.from(branches).some(b => b?.includes("Jogja"));
        return hasBekasi && hasJogja;
      })
      .map(([key, records]) => ({
        key,
        records,
        branches: [...new Set(records.map(r => r.asal_iklan))],
      }))
      .sort((a, b) => b.records.length - a.records.length);
  })();

  // Filter by search term
  const filteredGroups = duplicateGroups.filter((group) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      group.key.toLowerCase().includes(searchLower) ||
      group.records.some(
        (r) =>
          r.nama_client?.toLowerCase().includes(searchLower) ||
          r.nohp_client?.toString().includes(searchTerm)
      )
    );
  });

  const handleExportExcel = () => {
    if (filteredGroups.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const exportData: any[] = [];
    
    filteredGroups.forEach((group) => {
      group.records.forEach((record) => {
        exportData.push({
          "Grup Duplikat": group.key,
          "Jumlah Duplikat": group.records.length,
          "Tanggal": new Date(record.tanggal).toLocaleDateString("id-ID"),
          "Client ID": record.client_id,
          "Nama Client": record.nama_client,
          "No HP": record.nohp_client,
          "Source Iklan": record.source_iklan,
          "Asal Iklan": record.asal_iklan,
          "Nama EC": record.nama_ec || "-",
          "Status Payment": record.status_payment || "-",
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Data Duplikat");

    const fileName = `data_duplikat_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Data berhasil diexport");
  };

  const totalDuplicateRecords = filteredGroups.reduce(
    (sum, group) => sum + group.records.length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-warning" />
            Data Duplikat
          </h1>
          <p className="text-muted-foreground">
            Menampilkan data client yang muncul di kedua cabang (Bekasi & Jogja)
          </p>
        </div>
        <Button onClick={handleExportExcel} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Grup Duplikat</p>
          <p className="text-2xl font-bold">{filteredGroups.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Record Duplikat</p>
          <p className="text-2xl font-bold">{totalDuplicateRecords}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Tipe Deteksi</p>
          <p className="text-2xl font-bold capitalize">
            {duplicateType === "phone" ? "No HP" : "Nama Client"}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="search">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Cari nama atau no HP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-full sm:w-48">
            <Label htmlFor="duplicateType">Deteksi Berdasarkan</Label>
            <Select
              value={duplicateType}
              onValueChange={(v) => setDuplicateType(v as "phone" | "name")}
            >
              <SelectTrigger className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="phone">No HP</SelectItem>
                <SelectItem value="name">Nama Client</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Duplicate Groups */}
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">
          Loading...
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Tidak ditemukan data duplikat antara cabang Bekasi dan Jogja</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="bg-warning/10 p-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-warning" />
                    <span className="font-medium">
                      {duplicateType === "phone" ? "No HP" : "Nama"}: {group.key}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {group.branches.map((branch, i) => (
                      <span
                        key={i}
                        className={`text-xs px-2 py-1 rounded ${
                          branch?.includes("Bekasi")
                            ? "bg-blue-500/10 text-blue-500"
                            : "bg-green-500/10 text-green-500"
                        }`}
                      >
                        {branch?.includes("Bekasi") ? "Bekasi" : "Jogja"}
                      </span>
                    ))}
                    <span className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                      {group.records.length} record
                    </span>
                  </div>
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>No HP</TableHead>
                    <TableHead>Source Iklan</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Nama EC</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {group.records.map((record, recordIndex) => (
                    <TableRow key={recordIndex}>
                      <TableCell>
                        {new Date(record.tanggal).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {record.client_id}
                      </TableCell>
                      <TableCell>{record.nama_client}</TableCell>
                      <TableCell>{record.nohp_client}</TableCell>
                      <TableCell>{record.source_iklan}</TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            record.asal_iklan?.includes("Bekasi")
                              ? "bg-blue-500/10 text-blue-500"
                              : "bg-green-500/10 text-green-500"
                          }`}
                        >
                          {record.asal_iklan?.includes("Bekasi")
                            ? "Bekasi"
                            : "Jogja"}
                        </span>
                      </TableCell>
                      <TableCell>{record.nama_ec || "-"}</TableCell>
                      <TableCell>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            record.status_payment === "paid"
                              ? "bg-green-500/10 text-green-500"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {record.status_payment || "unpaid"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
