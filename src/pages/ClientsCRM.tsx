import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Users, Search, Crown, Repeat, UserCircle, TrendingUp, Calendar, Phone, Building2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";

// Normalize phone number to 628xxxxxxxxx format
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  let normalized = String(phone);
  if (normalized.includes("E") || normalized.includes("e")) {
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      normalized = num.toFixed(0);
    }
  }
  
  normalized = normalized.replace(/\D/g, "");
  
  if (normalized.startsWith("0")) {
    normalized = "62" + normalized.substring(1);
  } else if (normalized.startsWith("8")) {
    normalized = "62" + normalized;
  } else if (!normalized.startsWith("62")) {
    normalized = "62" + normalized;
  }
  
  return normalized;
}

interface ClientProfile {
  clientId: string;
  normalizedPhone: string;
  primaryName: string;
  ownerBranch: string | null;
  firstTransaction: string;
  lastTransaction: string;
  totalTransactions: number;
  paidTransactions: number;
  ltv: number;
  status: "New" | "Repeat" | "High Value";
  branches: string[];
  transactions: any[];
}

interface BranchAssignment {
  duplicate_key: string;
  duplicate_type: string;
  assigned_branch: string;
}

const HIGH_VALUE_THRESHOLD = 5; // Minimum paid transactions for High Value status

export default function ClientsCRM() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<ClientProfile | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Fetch all SH2M data
  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["clients-crm-sh2m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sh2m_data")
        .select("*")
        .order("tanggal", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch branch assignments for duplicates
  const { data: branchAssignments } = useQuery({
    queryKey: ["clients-crm-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duplicate_branch_assignments")
        .select("*");

      if (error) throw error;
      return (data || []) as BranchAssignment[];
    },
  });

  // Build client profiles
  const clientProfiles = useMemo(() => {
    if (!sh2mData) return [];

    // Group by normalized phone
    const phoneGroups = new Map<string, typeof sh2mData>();
    
    sh2mData.forEach(record => {
      const normalizedPhone = normalizePhoneNumber(record.nohp_client);
      if (!normalizedPhone || normalizedPhone.length < 10) return;
      
      if (!phoneGroups.has(normalizedPhone)) {
        phoneGroups.set(normalizedPhone, []);
      }
      phoneGroups.get(normalizedPhone)!.push(record);
    });

    // Create assignment lookup
    const assignmentLookup = new Map<string, string>();
    branchAssignments?.forEach(a => {
      assignmentLookup.set(a.duplicate_key, a.assigned_branch);
    });

    // Build profiles
    const profiles: ClientProfile[] = [];

    phoneGroups.forEach((records, normalizedPhone) => {
      // Sort by date
      const sortedRecords = [...records].sort(
        (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
      );

      // Get most common name
      const nameCounts = new Map<string, number>();
      records.forEach(r => {
        const name = r.nama_client?.trim() || "";
        if (name) {
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }
      });
      let primaryName = "";
      let maxCount = 0;
      nameCounts.forEach((count, name) => {
        if (count > maxCount) {
          maxCount = count;
          primaryName = name;
        }
      });

      // Get unique branches
      const branches = [...new Set(records.map(r => r.asal_iklan).filter(Boolean))] as string[];

      // Determine owner branch
      let ownerBranch: string | null = null;
      
      // Check if there's an admin assignment
      const assignment = assignmentLookup.get(normalizedPhone);
      if (assignment) {
        ownerBranch = assignment;
      } else if (branches.length === 1) {
        ownerBranch = branches[0];
      }

      // Calculate metrics
      const totalTransactions = records.length;
      const paidRecords = records.filter(r => r.status_payment === "paid");
      const paidTransactions = paidRecords.length;
      const ltv = paidTransactions; // For now, LTV = count of paid transactions

      // Determine status
      let status: "New" | "Repeat" | "High Value" = "New";
      if (paidTransactions >= HIGH_VALUE_THRESHOLD) {
        status = "High Value";
      } else if (totalTransactions >= 2) {
        status = "Repeat";
      }

      profiles.push({
        clientId: `CL-${normalizedPhone.slice(-8)}`,
        normalizedPhone,
        primaryName: primaryName || "Unknown",
        ownerBranch,
        firstTransaction: sortedRecords[0]?.tanggal || "",
        lastTransaction: sortedRecords[sortedRecords.length - 1]?.tanggal || "",
        totalTransactions,
        paidTransactions,
        ltv,
        status,
        branches,
        transactions: sortedRecords,
      });
    });

    // Sort by total transactions (descending)
    return profiles.sort((a, b) => b.totalTransactions - a.totalTransactions);
  }, [sh2mData, branchAssignments]);

  // Filter profiles by search
  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return clientProfiles;
    
    const query = searchQuery.toLowerCase();
    return clientProfiles.filter(p => 
      p.primaryName.toLowerCase().includes(query) ||
      p.normalizedPhone.includes(query) ||
      p.clientId.toLowerCase().includes(query)
    );
  }, [clientProfiles, searchQuery]);

  // Summary stats
  const stats = useMemo(() => {
    const total = clientProfiles.length;
    const newClients = clientProfiles.filter(p => p.status === "New").length;
    const repeatClients = clientProfiles.filter(p => p.status === "Repeat").length;
    const highValue = clientProfiles.filter(p => p.status === "High Value").length;
    const totalLTV = clientProfiles.reduce((sum, p) => sum + p.ltv, 0);

    return { total, newClients, repeatClients, highValue, totalLTV };
  }, [clientProfiles]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "High Value":
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white"><Crown className="h-3 w-3 mr-1" />High Value</Badge>;
      case "Repeat":
        return <Badge className="bg-blue-500 hover:bg-blue-600 text-white"><Repeat className="h-3 w-3 mr-1" />Repeat</Badge>;
      default:
        return <Badge variant="secondary"><UserCircle className="h-3 w-3 mr-1" />New</Badge>;
    }
  };

  const getBranchLabel = (branch: string | null) => {
    if (!branch) return "-";
    if (branch.includes("Bekasi")) return "Bekasi";
    if (branch.includes("Jogja")) return "Jogja";
    return branch;
  };

  const openClientDetail = (client: ClientProfile) => {
    setSelectedClient(client);
    setDetailOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Clients CRM</h1>
          <p className="text-muted-foreground">Profil client terintegrasi - Semua Cabang</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Total Clients</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.total.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-muted-foreground">New Clients</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.newClients.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Repeat Clients</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.repeatClients.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">High Value</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.highValue.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Total LTV</span>
            </div>
            <p className="text-2xl font-bold mt-2">{stats.totalLTV.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">paid transactions</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari nama, no HP, atau client ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Client List */}
      <Card>
        <CardHeader>
          <CardTitle>Client List ({filteredProfiles.length.toLocaleString()})</CardTitle>
          <CardDescription>Klik baris untuk melihat detail profil client</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client ID</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>No HP</TableHead>
                  <TableHead>Cabang Owner</TableHead>
                  <TableHead>Total Transaksi</TableHead>
                  <TableHead>LTV</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.slice(0, 100).map((client) => (
                  <TableRow 
                    key={client.normalizedPhone} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openClientDetail(client)}
                  >
                    <TableCell className="font-mono text-xs">{client.clientId}</TableCell>
                    <TableCell className="font-medium">{client.primaryName}</TableCell>
                    <TableCell className="font-mono">{client.normalizedPhone}</TableCell>
                    <TableCell>
                      {client.ownerBranch ? (
                        <Badge variant="outline">{getBranchLabel(client.ownerBranch)}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>{client.totalTransactions}</TableCell>
                    <TableCell className="font-semibold text-green-600">{client.ltv}</TableCell>
                    <TableCell>{getStatusBadge(client.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredProfiles.length > 100 && (
              <p className="text-center text-sm text-muted-foreground mt-4">
                Menampilkan 100 dari {filteredProfiles.length.toLocaleString()} clients
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Client Profile Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCircle className="h-6 w-6" />
              Client Profile Detail
            </DialogTitle>
          </DialogHeader>
          
          {selectedClient && (
            <div className="space-y-6">
              {/* Client Identity */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{selectedClient.primaryName}</CardTitle>
                    <div className="flex gap-2">
                      {getStatusBadge(selectedClient.status)}
                      {selectedClient.status === "High Value" && (
                        <Badge className="bg-purple-500 text-white">VIP</Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="font-mono">ID</span>
                      </p>
                      <p className="font-mono font-medium">{selectedClient.clientId}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Phone className="h-3 w-3" /> No HP
                      </p>
                      <p className="font-mono font-medium">{selectedClient.normalizedPhone}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" /> Cabang Owner
                      </p>
                      <p className="font-medium">
                        {selectedClient.ownerBranch ? getBranchLabel(selectedClient.ownerBranch) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cabang Aktif</p>
                      <div className="flex gap-1 flex-wrap">
                        {selectedClient.branches.map(b => (
                          <Badge key={b} variant="outline" className="text-xs">
                            {getBranchLabel(b)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold">{selectedClient.totalTransactions}</p>
                    <p className="text-xs text-muted-foreground">Total Transaksi</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-green-600">{selectedClient.paidTransactions}</p>
                    <p className="text-xs text-muted-foreground">Paid Transactions</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-3xl font-bold text-primary">{selectedClient.ltv}</p>
                    <p className="text-xs text-muted-foreground">LTV (Lifetime Value)</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-sm font-medium">
                      {selectedClient.firstTransaction && format(new Date(selectedClient.firstTransaction), "dd MMM yyyy", { locale: id })}
                    </p>
                    <p className="text-xs text-muted-foreground">First Transaction</p>
                    <p className="text-sm font-medium mt-2">
                      {selectedClient.lastTransaction && format(new Date(selectedClient.lastTransaction), "dd MMM yyyy", { locale: id })}
                    </p>
                    <p className="text-xs text-muted-foreground">Last Transaction</p>
                  </CardContent>
                </Card>
              </div>

              {/* Transaction Timeline */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Riwayat Transaksi
                  </CardTitle>
                  <CardDescription>Semua transaksi dari sh2m_data</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto">
                    {selectedClient.transactions.map((tx, idx) => (
                      <div 
                        key={tx.id} 
                        className={`flex items-start gap-4 p-3 rounded-lg border ${
                          tx.status_payment === "paid" ? "bg-green-50 border-green-200" : "bg-muted/30"
                        }`}
                      >
                        <div className="flex-shrink-0 w-20 text-center">
                          <p className="text-sm font-medium">
                            {format(new Date(tx.tanggal), "dd MMM", { locale: id })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.tanggal), "yyyy")}
                          </p>
                          {tx.jam && <p className="text-xs text-muted-foreground">{tx.jam}</p>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={tx.status_payment === "paid" ? "default" : "secondary"}>
                              {tx.status_payment || "unpaid"}
                            </Badge>
                            <Badge variant="outline">{getBranchLabel(tx.asal_iklan)}</Badge>
                          </div>
                          <p className="text-sm mt-1 truncate">{tx.source_iklan}</p>
                          {tx.nama_ec && (
                            <p className="text-xs text-muted-foreground">EC: {tx.nama_ec}</p>
                          )}
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          #{selectedClient.transactions.length - idx}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
