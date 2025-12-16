import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Download, Search, AlertTriangle, Eye, Lock } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

interface DuplicateRecord {
  id: string;
  tanggal: string;
  nama_client: string;
  nohp_client: string;
  source_iklan: string;
  asal_iklan: string;
  nama_ec: string | null;
  status_payment: string | null;
  client_id: string;
}

interface DuplicateGroup {
  key: string;
  records: DuplicateRecord[];
  duplicateType: "same-branch" | "cross-branch";
  assignedBranch?: string | null;
}

interface BranchAssignment {
  id: string;
  duplicate_key: string;
  duplicate_type: string;
  assigned_branch: string;
}

export default function DataDuplikat() {
  const [searchTerm, setSearchTerm] = useState("");
  const [duplicateType, setDuplicateType] = useState<"phone" | "name">("phone");
  const [filterType, setFilterType] = useState<"all" | "same-branch" | "cross-branch">("all");
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const queryClient = useQueryClient();

  // Fetch all SH2M data from both branches with pagination
  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["sh2m-all-data"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("sh2m_data")
          .select("*")
          .range(from, from + PAGE_SIZE - 1)
          .order("tanggal", { ascending: false });
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      return allData;
    },
  });

  // Fetch branch assignments with pagination
  const { data: branchAssignments } = useQuery({
    queryKey: ["duplicate-branch-assignments", duplicateType],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: BranchAssignment[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("duplicate_branch_assignments")
          .select("*")
          .eq("duplicate_type", duplicateType)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...(data as BranchAssignment[])];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      return allData;
    },
  });

  // Mutation to save/update branch assignment
  const assignBranchMutation = useMutation({
    mutationFn: async ({ 
      duplicateKey, 
      assignedBranch 
    }: { 
      duplicateKey: string; 
      assignedBranch: string;
    }) => {
      // Check if assignment exists
      const { data: existing } = await supabase
        .from("duplicate_branch_assignments")
        .select("id")
        .eq("duplicate_key", duplicateKey)
        .eq("duplicate_type", duplicateType)
        .single();

      if (existing) {
        // Update
        const { error } = await supabase
          .from("duplicate_branch_assignments")
          .update({ assigned_branch: assignedBranch })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        // Insert
        const { error } = await supabase
          .from("duplicate_branch_assignments")
          .insert({
            duplicate_key: duplicateKey,
            duplicate_type: duplicateType,
            assigned_branch: assignedBranch,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["duplicate-branch-assignments"] });
      toast.success("Cabang berhasil ditentukan");
    },
    onError: (error) => {
      console.error("Error assigning branch:", error);
      toast.error("Gagal menyimpan penentuan cabang");
    },
  });

  // Create assignment map for quick lookup
  const assignmentMap = new Map<string, string>();
  branchAssignments?.forEach((assignment) => {
    assignmentMap.set(assignment.duplicate_key, assignment.assigned_branch);
  });

  // Find duplicates
  const duplicateGroups: DuplicateGroup[] = (() => {
    if (!sh2mData) return [];

    const groups: Record<string, DuplicateRecord[]> = {};
    
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

    // Filter to only show groups with more than 1 record (duplicates)
    return Object.entries(groups)
      .filter(([_, records]) => records.length > 1)
      .map(([key, records]) => {
        const branches = new Set(records.map(r => r.asal_iklan));
        const hasBekasi = Array.from(branches).some(b => b?.includes("Bekasi"));
        const hasJogja = Array.from(branches).some(b => b?.includes("Jogja"));
        const isCrossBranch = hasBekasi && hasJogja;
        
        return {
          key,
          records: records.sort((a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()),
          duplicateType: isCrossBranch ? "cross-branch" : "same-branch" as "same-branch" | "cross-branch",
          assignedBranch: assignmentMap.get(key) || null,
        };
      })
      .sort((a, b) => b.records.length - a.records.length);
  })();

  // Filter by search term and type
  const filteredGroups = duplicateGroups.filter((group) => {
    // Filter by duplicate type
    if (filterType === "same-branch" && group.duplicateType !== "same-branch") return false;
    if (filterType === "cross-branch" && group.duplicateType !== "cross-branch") return false;
    
    // Filter by search term
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

  const getBranchLabel = (asalIklan: string | null) => {
    if (!asalIklan) return "Unknown";
    if (asalIklan.includes("Bekasi")) return "Bekasi";
    if (asalIklan.includes("Jogja")) return "Jogja";
    return asalIklan;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleBranchChange = (groupKey: string, branch: string) => {
    assignBranchMutation.mutate({
      duplicateKey: groupKey,
      assignedBranch: branch,
    });
  };

  const isRecordFrozen = (record: DuplicateRecord, assignedBranch: string | null) => {
    if (!assignedBranch) return false;
    const recordBranch = getBranchLabel(record.asal_iklan);
    return recordBranch !== assignedBranch;
  };

  const handleExportExcel = () => {
    if (filteredGroups.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const exportData = filteredGroups.map((group) => {
      const row: Record<string, string> = {
        "No HP / Nama": group.key,
        "Jumlah Duplikat": group.records.length.toString(),
        "Tipe Duplikat": group.duplicateType === "cross-branch" ? "Antar Cabang" : "Sesama Cabang",
        "Nama Client": group.records[0].nama_client,
        "Cabang Terpilih": group.assignedBranch || "-",
      };

      // Add duplicate columns
      group.records.forEach((record, index) => {
        const isFrozen = isRecordFrozen(record, group.assignedBranch);
        row[`Duplikat ${index + 1}`] = `${getBranchLabel(record.asal_iklan)} - ${formatDate(record.tanggal)}${isFrozen ? " (Frozen)" : ""}`;
      });

      return row;
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

  const sameBranchCount = filteredGroups.filter(g => g.duplicateType === "same-branch").length;
  const crossBranchCount = filteredGroups.filter(g => g.duplicateType === "cross-branch").length;

  // Get max duplicates for dynamic columns
  const maxDuplicates = Math.max(...(filteredGroups.map(g => g.records.length) || [0]), 2);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-warning" />
            Data Duplikat
          </h1>
          <p className="text-muted-foreground">
            Menampilkan data client duplikat dari semua cabang
          </p>
        </div>
        <Button onClick={handleExportExcel} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export Excel
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Grup Duplikat</p>
          <p className="text-2xl font-bold">{filteredGroups.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Total Record</p>
          <p className="text-2xl font-bold">{totalDuplicateRecords}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Sesama Cabang</p>
          <p className="text-2xl font-bold text-yellow-500">{sameBranchCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Antar Cabang</p>
          <p className="text-2xl font-bold text-red-500">{crossBranchCount}</p>
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
          <div className="w-full sm:w-48">
            <Label htmlFor="filterType">Tipe Duplikat</Label>
            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as "all" | "same-branch" | "cross-branch")}
            >
              <SelectTrigger className="bg-popover">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="same-branch">Sesama Cabang</SelectItem>
                <SelectItem value="cross-branch">Antar Cabang</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Duplicate Table */}
      {isLoading ? (
        <Card className="p-8 text-center text-muted-foreground">
          Loading...
        </Card>
      ) : filteredGroups.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Tidak ditemukan data duplikat</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>Nama Client</TableHead>
                <TableHead>No HP</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Cabang</TableHead>
                <TableHead>Jumlah</TableHead>
                {Array.from({ length: Math.min(maxDuplicates, 5) }, (_, i) => (
                  <TableHead key={i}>Duplikat {i + 1}</TableHead>
                ))}
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell>{group.records[0].nama_client}</TableCell>
                  <TableCell className="font-mono">{group.records[0].nohp_client}</TableCell>
                  <TableCell>
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        group.duplicateType === "cross-branch"
                          ? "bg-red-500/10 text-red-500"
                          : "bg-yellow-500/10 text-yellow-500"
                      }`}
                    >
                      {group.duplicateType === "cross-branch" ? "Antar Cabang" : "Sesama Cabang"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={group.assignedBranch || ""}
                      onValueChange={(v) => handleBranchChange(group.key, v)}
                    >
                      <SelectTrigger className="w-28 bg-popover h-8">
                        <SelectValue placeholder="Pilih" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover z-50">
                        <SelectItem value="Bekasi">Bekasi</SelectItem>
                        <SelectItem value="Jogja">Jogja</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 rounded bg-muted">
                      {group.records.length}x
                    </span>
                  </TableCell>
                  {Array.from({ length: Math.min(maxDuplicates, 5) }, (_, i) => (
                    <TableCell key={i} className="text-sm">
                      {group.records[i] ? (
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1">
                            <span
                              className={`text-xs px-1.5 py-0.5 rounded w-fit ${
                                group.records[i].asal_iklan?.includes("Bekasi")
                                  ? "bg-blue-500/10 text-blue-500"
                                  : "bg-green-500/10 text-green-500"
                              }`}
                            >
                              {getBranchLabel(group.records[i].asal_iklan)}
                            </span>
                            {isRecordFrozen(group.records[i], group.assignedBranch) && (
                              <Lock className="h-3 w-3 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-muted-foreground text-xs mt-0.5">
                            {formatDate(group.records[i].tanggal)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedGroup(group)}
                      className="gap-1"
                    >
                      <Eye className="h-4 w-4" />
                      Detail
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedGroup} onOpenChange={(open) => !open && setSelectedGroup(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Detail Duplikat - {selectedGroup?.records[0]?.nama_client}
            </DialogTitle>
          </DialogHeader>
          
          {selectedGroup && (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="bg-muted rounded-lg p-3 flex-1 min-w-[120px]">
                  <p className="text-sm text-muted-foreground">No HP</p>
                  <p className="font-mono font-medium">{selectedGroup.records[0].nohp_client}</p>
                </div>
                <div className="bg-muted rounded-lg p-3 flex-1 min-w-[120px]">
                  <p className="text-sm text-muted-foreground">Jumlah Duplikat</p>
                  <p className="font-medium">{selectedGroup.records.length} record</p>
                </div>
                <div className="bg-muted rounded-lg p-3 flex-1 min-w-[120px]">
                  <p className="text-sm text-muted-foreground">Tipe</p>
                  <p className={`font-medium ${
                    selectedGroup.duplicateType === "cross-branch" ? "text-red-500" : "text-yellow-500"
                  }`}>
                    {selectedGroup.duplicateType === "cross-branch" ? "Antar Cabang" : "Sesama Cabang"}
                  </p>
                </div>
                <div className="bg-muted rounded-lg p-3 flex-1 min-w-[120px]">
                  <p className="text-sm text-muted-foreground">Cabang Terpilih</p>
                  <p className="font-medium text-primary">
                    {selectedGroup.assignedBranch || "Belum dipilih"}
                  </p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Source Iklan</TableHead>
                    <TableHead>Nama EC</TableHead>
                    <TableHead>Status Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedGroup.records.map((record, index) => {
                    const isFrozen = isRecordFrozen(record, selectedGroup.assignedBranch);
                    return (
                      <TableRow key={record.id} className={isFrozen ? "opacity-50" : ""}>
                        <TableCell className="font-medium">
                          Duplikat {index + 1}
                        </TableCell>
                        <TableCell>{formatDate(record.tanggal)}</TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              record.asal_iklan?.includes("Bekasi")
                                ? "bg-blue-500/10 text-blue-500"
                                : "bg-green-500/10 text-green-500"
                            }`}
                          >
                            {getBranchLabel(record.asal_iklan)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {isFrozen ? (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                              <Lock className="h-3 w-3" />
                              Frozen
                            </span>
                          ) : (
                            <span className="text-xs px-2 py-1 rounded bg-green-500/10 text-green-500">
                              Aktif
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{record.client_id}</TableCell>
                        <TableCell>{record.source_iklan}</TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>

              {selectedGroup.assignedBranch && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Data dengan status "Frozen" tidak dapat diolah oleh cabang tersebut karena admin telah menentukan cabang <strong>{selectedGroup.assignedBranch}</strong> sebagai pemilik data ini.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
