import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  BarChart3, TrendingUp, Users, AlertTriangle, Shield, Crown, 
  Repeat, Building2, Target, Clock, CheckCircle, XCircle, AlertCircle,
  DollarSign, Percent, UserCheck
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays, isAfter, differenceInDays } from "date-fns";
import { id } from "date-fns/locale";

// Normalize phone number
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  let normalized = String(phone);
  if (normalized.includes("E") || normalized.includes("e")) {
    const num = parseFloat(normalized);
    if (!isNaN(num)) normalized = num.toFixed(0);
  }
  normalized = normalized.replace(/\D/g, "");
  if (normalized.startsWith("0")) normalized = "62" + normalized.substring(1);
  else if (normalized.startsWith("8")) normalized = "62" + normalized;
  else if (!normalized.startsWith("62")) normalized = "62" + normalized;
  return normalized;
}

function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  return /^62\d{8,13}$/.test(normalized);
}

type DateFilter = "today" | "week" | "month" | "all";

export default function CEODashboard() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");

  const today = new Date();
  const getDateRange = () => {
    switch (dateFilter) {
      case "today": return { start: today, end: today };
      case "week": return { start: subDays(today, 7), end: today };
      case "month": return { start: startOfMonth(today), end: endOfMonth(today) };
      default: return { start: null, end: null };
    }
  };

  // Fetch all SH2M data
  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["ceo-dashboard-sh2m"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sh2m_data")
        .select("*")
        .order("tanggal", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch source categories
  const { data: categories } = useQuery({
    queryKey: ["ceo-dashboard-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("source_iklan_categories")
        .select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // Filter data by date range
  const filteredData = useMemo(() => {
    if (!sh2mData) return [];
    const range = getDateRange();
    if (!range.start) return sh2mData;
    
    return sh2mData.filter(d => {
      const recordDate = new Date(d.tanggal);
      return recordDate >= range.start! && recordDate <= range.end!;
    });
  }, [sh2mData, dateFilter]);

  // Calculate all metrics
  const metrics = useMemo(() => {
    if (!sh2mData) return null;

    const categoriesMap = new Map(categories?.map(c => [c.source_iklan, c.kategori]) || []);
    const categorizedSources = new Set(categories?.filter(c => c.kategori)?.map(c => c.source_iklan) || []);

    // ===== EXECUTIVE SUMMARY =====
    const totalTransactions = filteredData.length;
    const paidTransactions = filteredData.filter(d => d.status_payment === "paid").length;
    const paidRate = totalTransactions > 0 ? (paidTransactions / totalTransactions) * 100 : 0;

    // Unique clients (by normalized phone)
    const uniquePhones = new Set<string>();
    const phoneTransactions = new Map<string, any[]>();
    
    filteredData.forEach(d => {
      const phone = normalizePhoneNumber(d.nohp_client);
      if (phone && phone.length >= 10) {
        uniquePhones.add(phone);
        if (!phoneTransactions.has(phone)) phoneTransactions.set(phone, []);
        phoneTransactions.get(phone)!.push(d);
      }
    });

    const uniqueClients = uniquePhones.size;
    let repeatClients = 0;
    let highValueClients = 0;
    const HIGH_VALUE_THRESHOLD = 5;

    phoneTransactions.forEach((txs) => {
      const paidCount = txs.filter(t => t.status_payment === "paid").length;
      if (txs.length >= 2) repeatClients++;
      if (paidCount >= HIGH_VALUE_THRESHOLD) highValueClients++;
    });

    const repeatRate = uniqueClients > 0 ? (repeatClients / uniqueClients) * 100 : 0;
    const newClients = uniqueClients - repeatClients;

    // Data Trust Score
    let dataIssues = 0;
    sh2mData.forEach(d => {
      if (!d.nohp_client || !isValidPhoneNumber(d.nohp_client)) dataIssues++;
      if (!d.source_iklan) dataIssues++;
      if (!d.status_payment) dataIssues++;
    });
    const trustScore = sh2mData.length > 0 ? ((sh2mData.length - dataIssues) / sh2mData.length) * 100 : 100;

    // Unpaid > 7 days
    let unpaidOver7Days = 0;
    sh2mData.forEach(d => {
      if (d.status_payment === "unpaid" && d.tanggal) {
        const daysDiff = differenceInDays(today, new Date(d.tanggal));
        if (daysDiff > 7) unpaidOver7Days++;
      }
    });

    // ===== BRANCH PERFORMANCE =====
    const branchStats = new Map<string, {
      total: number;
      paid: number;
      uniquePhones: Set<string>;
      repeatPhones: Set<string>;
    }>();

    ["SEFT Corp - Bekasi", "SEFT Corp - Jogja"].forEach(branch => {
      branchStats.set(branch, { total: 0, paid: 0, uniquePhones: new Set(), repeatPhones: new Set() });
    });

    const branchPhoneCount = new Map<string, Map<string, number>>();
    
    filteredData.forEach(d => {
      const branch = d.asal_iklan || "";
      if (!branchStats.has(branch)) return;
      
      const stats = branchStats.get(branch)!;
      stats.total++;
      if (d.status_payment === "paid") stats.paid++;
      
      const phone = normalizePhoneNumber(d.nohp_client);
      if (phone) {
        stats.uniquePhones.add(phone);
        
        if (!branchPhoneCount.has(branch)) branchPhoneCount.set(branch, new Map());
        const phoneMap = branchPhoneCount.get(branch)!;
        phoneMap.set(phone, (phoneMap.get(phone) || 0) + 1);
      }
    });

    branchPhoneCount.forEach((phoneMap, branch) => {
      phoneMap.forEach((count, phone) => {
        if (count >= 2) branchStats.get(branch)?.repeatPhones.add(phone);
      });
    });

    const branchPerformance = Array.from(branchStats.entries()).map(([branch, stats]) => ({
      branch,
      branchLabel: branch.includes("Bekasi") ? "Bekasi" : "Jogja",
      total: stats.total,
      paid: stats.paid,
      paidRate: stats.total > 0 ? (stats.paid / stats.total) * 100 : 0,
      uniqueClients: stats.uniquePhones.size,
      repeatRate: stats.uniquePhones.size > 0 ? (stats.repeatPhones.size / stats.uniquePhones.size) * 100 : 0,
    })).sort((a, b) => b.paid - a.paid);

    // ===== SOURCE IKLAN PERFORMANCE (Top 10) =====
    const sourceStats = new Map<string, {
      total: number;
      paid: number;
      uniquePhones: Set<string>;
    }>();

    filteredData.forEach(d => {
      const source = d.source_iklan || "Unknown";
      if (!sourceStats.has(source)) {
        sourceStats.set(source, { total: 0, paid: 0, uniquePhones: new Set() });
      }
      const stats = sourceStats.get(source)!;
      stats.total++;
      if (d.status_payment === "paid") stats.paid++;
      const phone = normalizePhoneNumber(d.nohp_client);
      if (phone) stats.uniquePhones.add(phone);
    });

    const sourcePerformance = Array.from(sourceStats.entries())
      .map(([source, stats]) => ({
        source,
        kategori: categoriesMap.get(source) || null,
        total: stats.total,
        paid: stats.paid,
        paidRate: stats.total > 0 ? (stats.paid / stats.total) * 100 : 0,
        uniqueClients: stats.uniquePhones.size,
      }))
      .sort((a, b) => b.paid - a.paid)
      .slice(0, 10);

    // ===== RISK & ALERTS =====
    const alerts: { type: "critical" | "warning"; message: string; count: number }[] = [];

    // Duplicates
    const allPhones = new Map<string, number>();
    sh2mData.forEach(d => {
      const phone = normalizePhoneNumber(d.nohp_client);
      if (phone) allPhones.set(phone, (allPhones.get(phone) || 0) + 1);
    });
    const duplicatePhones = Array.from(allPhones.values()).filter(c => c > 1).length;
    if (duplicatePhones > 50) {
      alerts.push({ type: "warning", message: "Data duplikat tinggi", count: duplicatePhones });
    }

    // Uncategorized sources
    const uncategorizedCount = Array.from(sourceStats.keys()).filter(s => !categorizedSources.has(s) && s !== "Unknown").length;
    if (uncategorizedCount > 0) {
      alerts.push({ type: "warning", message: "Source iklan belum dikategorikan", count: uncategorizedCount });
    }

    // Unpaid > 7 days
    if (unpaidOver7Days > 20) {
      alerts.push({ type: "critical", message: "Unpaid > 7 hari melebihi threshold", count: unpaidOver7Days });
    } else if (unpaidOver7Days > 0) {
      alerts.push({ type: "warning", message: "Unpaid > 7 hari perlu follow up", count: unpaidOver7Days });
    }

    // Empty data
    const emptyPhone = sh2mData.filter(d => !d.nohp_client || d.nohp_client.trim() === "").length;
    const emptySource = sh2mData.filter(d => !d.source_iklan || d.source_iklan.trim() === "").length;
    const emptyStatus = sh2mData.filter(d => !d.status_payment).length;

    if (emptyPhone > 0) alerts.push({ type: "critical", message: "Data dengan no HP kosong", count: emptyPhone });
    if (emptySource > 0) alerts.push({ type: "warning", message: "Data tanpa source iklan", count: emptySource });
    if (emptyStatus > 0) alerts.push({ type: "warning", message: "Data tanpa status payment", count: emptyStatus });

    // LTV calculation
    const totalLTV = paidTransactions; // Count of paid as LTV proxy

    return {
      // Executive Summary
      totalTransactions,
      paidTransactions,
      paidRate,
      uniqueClients,
      repeatClients,
      repeatRate,
      newClients,
      highValueClients,
      trustScore,
      unpaidOver7Days,
      totalLTV,
      // Branch Performance
      branchPerformance,
      // Source Performance
      sourcePerformance,
      // Alerts
      alerts,
    };
  }, [filteredData, sh2mData, categories]);

  const getTrustBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">CEO Command Center</h1>
            <p className="text-muted-foreground">Executive Dashboard - Semua Cabang</p>
          </div>
        </div>
        <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Hari Ini</SelectItem>
            <SelectItem value="week">7 Hari Terakhir</SelectItem>
            <SelectItem value="month">Bulan Ini</SelectItem>
            <SelectItem value="all">Semua Data</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* A. Executive Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Paid Revenue</span>
            </div>
            <p className="text-2xl font-bold mt-2 text-green-600">{metrics?.paidTransactions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">transactions</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Paid Rate</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.paidRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">{metrics?.paidTransactions}/{metrics?.totalTransactions}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Unique Clients</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.uniqueClients.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Repeat Clients</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.repeatClients.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics?.repeatRate.toFixed(1)}% rate</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-red-500" />
              <span className="text-sm text-muted-foreground">Unpaid &gt;7d</span>
            </div>
            <p className="text-2xl font-bold mt-2 text-red-600">{metrics?.unpaidOver7Days.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm text-muted-foreground">Data Trust</span>
            </div>
            <div className="mt-2">{metrics && getTrustBadge(metrics.trustScore)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* B. Branch Performance */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Cabang Performance
            </CardTitle>
            <CardDescription>Performa per cabang (sorted by paid)</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Clients</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics?.branchPerformance.map((b) => (
                  <TableRow key={b.branch}>
                    <TableCell>
                      <Badge variant="outline">{b.branchLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{b.paid.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{b.paidRate.toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{b.uniqueClients.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* D. Client Value Overview */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Client Value Overview
            </CardTitle>
            <CardDescription>Ringkasan nilai client dari CRM</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg text-center">
                <p className="text-3xl font-bold">{metrics?.newClients.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">New Clients</p>
              </div>
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-600">{metrics?.repeatClients.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Repeat Clients</p>
              </div>
              <div className="p-4 bg-amber-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-amber-600">{metrics?.highValueClients.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">High Value</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{metrics?.totalLTV.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total LTV</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* C. Source Iklan Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Top 10 Source Iklan Performance
          </CardTitle>
          <CardDescription>Source iklan dengan paid tertinggi</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Source Iklan</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead className="text-right">Transaksi</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Clients</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics?.sourcePerformance.map((s, idx) => (
                <TableRow key={s.source}>
                  <TableCell className="font-medium">{idx + 1}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.source}</TableCell>
                  <TableCell>
                    {s.kategori ? (
                      <Badge variant="outline">{s.kategori}</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3 mr-1" />Belum
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{s.total.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold text-green-600">{s.paid.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{s.paidRate.toFixed(1)}%</TableCell>
                  <TableCell className="text-right">{s.uniqueClients.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* E. Risk & Alert Panel */}
      <Card className={metrics?.alerts.some(a => a.type === "critical") ? "border-red-300" : ""}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Risk & Alerts
          </CardTitle>
          <CardDescription>Peringatan otomatis yang perlu perhatian</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.alerts.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
              <p>Tidak ada alert aktif</p>
            </div>
          ) : (
            <div className="space-y-2">
              {metrics?.alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    alert.type === "critical" 
                      ? "bg-red-50 border-red-200" 
                      : "bg-yellow-50 border-yellow-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {alert.type === "critical" ? (
                      <XCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-yellow-500" />
                    )}
                    <span className="font-medium">{alert.message}</span>
                  </div>
                  <Badge className={alert.type === "critical" ? "bg-red-500" : "bg-yellow-500"}>
                    {alert.count.toLocaleString()}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
