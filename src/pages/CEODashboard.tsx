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
  DollarSign, Percent, UserCheck, CreditCard, Wallet, Receipt
} from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  "Lunas": "#22c55e",
  "DP": "#f59e0b",
  "Angsuran": "#3b82f6",
  "Pelunasan": "#8b5cf6",
  "Bonus": "#ec4899",
};

// Generate year options (from 2023 to current year + 1)
const currentYear = new Date().getFullYear();
const yearOptions = Array.from({ length: currentYear - 2022 }, (_, i) => 2023 + i);

// Month names in Indonesian
const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

export default function CEODashboard() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  const getDateRange = () => {
    const start = new Date(selectedYear, selectedMonth, 1);
    const end = new Date(selectedYear, selectedMonth + 1, 0); // Last day of month
    return { start, end };
  };

  // Fetch all SH2M data
  const { data: sh2mData, isLoading: loadingSh2m } = useQuery({
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

  // Fetch all Highticket data
  const { data: highticketData, isLoading: loadingHighticket } = useQuery({
    queryKey: ["ceo-dashboard-highticket"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("highticket_data")
        .select("*")
        .order("tanggal_transaksi", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch payment history for outstanding calculation
  const { data: paymentHistory } = useQuery({
    queryKey: ["ceo-dashboard-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_history")
        .select("*");
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

  const isLoading = loadingSh2m || loadingHighticket;

  // Filter data by date range
  const filteredSh2m = useMemo(() => {
    if (!sh2mData) return [];
    const range = getDateRange();
    
    return sh2mData.filter(d => {
      const recordDate = new Date(d.tanggal);
      return recordDate >= range.start && recordDate <= range.end;
    });
  }, [sh2mData, selectedMonth, selectedYear]);

  const filteredHighticket = useMemo(() => {
    if (!highticketData) return [];
    const range = getDateRange();
    
    return highticketData.filter(d => {
      const recordDate = new Date(d.tanggal_transaksi);
      return recordDate >= range.start && recordDate <= range.end;
    });
  }, [highticketData, selectedMonth, selectedYear]);

  // Calculate all metrics
  const metrics = useMemo(() => {
    if (!sh2mData || !highticketData) return null;

    const categoriesMap = new Map(categories?.map(c => [c.source_iklan, c.kategori]) || []);
    const categorizedSources = new Set(categories?.filter(c => c.kategori)?.map(c => c.source_iklan) || []);

    // ===== REVENUE METRICS FROM HIGHTICKET =====
    // Total Revenue (Lunas + Pelunasan)
    const revenueTransactions = filteredHighticket.filter(
      d => d.status_payment === "Lunas" || d.status_payment === "Pelunasan"
    );
    const totalRevenue = revenueTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // MTD Revenue
    const mtdStart = startOfMonth(today);
    const mtdEnd = endOfMonth(today);
    const mtdTransactions = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date >= mtdStart && date <= mtdEnd && 
        (d.status_payment === "Lunas" || d.status_payment === "Pelunasan");
    });
    const mtdRevenue = mtdTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // Outstanding (DP + Angsuran - payments made)
    const outstandingTransactions = filteredHighticket.filter(
      d => d.status_payment === "DP" || d.status_payment === "Angsuran"
    );
    let totalOutstanding = 0;
    outstandingTransactions.forEach(ht => {
      const targetAmount = ht.harga_bayar ? Number(ht.harga_bayar) : Number(ht.harga);
      const payments = paymentHistory?.filter(p => p.highticket_id === ht.id) || [];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah_bayar), 0);
      totalOutstanding += Math.max(0, targetAmount - totalPaid);
    });

    // ARPC (Average Revenue Per Client)
    const uniqueHighticketClients = new Set(filteredHighticket.map(d => normalizePhoneNumber(d.nohp)));
    const arpc = uniqueHighticketClients.size > 0 ? totalRevenue / uniqueHighticketClients.size : 0;

    // ===== PAYMENT STATUS DISTRIBUTION =====
    const paymentStatusCounts: Record<string, number> = {};
    filteredHighticket.forEach(d => {
      const status = d.status_payment || "Unknown";
      paymentStatusCounts[status] = (paymentStatusCounts[status] || 0) + 1;
    });
    const paymentStatusData = Object.entries(paymentStatusCounts).map(([name, value]) => ({
      name,
      value,
      color: PAYMENT_STATUS_COLORS[name] || "#94a3b8",
    }));

    // ===== REVENUE BY BRANCH =====
    const branchRevenue: Record<string, { total: number; paid: number; revenue: number; outstanding: number }> = {
      "SEFT Corp - Bekasi": { total: 0, paid: 0, revenue: 0, outstanding: 0 },
      "SEFT Corp - Jogja": { total: 0, paid: 0, revenue: 0, outstanding: 0 },
    };

    filteredHighticket.forEach(d => {
      const branch = d.asal_iklan || "";
      if (!branchRevenue[branch]) return;
      
      branchRevenue[branch].total++;
      if (d.status_payment === "Lunas" || d.status_payment === "Pelunasan") {
        branchRevenue[branch].paid++;
        branchRevenue[branch].revenue += Number(d.harga || 0);
      }
      if (d.status_payment === "DP" || d.status_payment === "Angsuran") {
        const targetAmount = d.harga_bayar ? Number(d.harga_bayar) : Number(d.harga);
        const payments = paymentHistory?.filter(p => p.highticket_id === d.id) || [];
        const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah_bayar), 0);
        branchRevenue[branch].outstanding += Math.max(0, targetAmount - totalPaid);
      }
    });

    const branchRevenueData = Object.entries(branchRevenue).map(([branch, data]) => ({
      branch,
      branchLabel: branch.includes("Bekasi") ? "Bekasi" : "Jogja",
      ...data,
    })).sort((a, b) => b.revenue - a.revenue);

    // ===== EC PERFORMANCE =====
    const ecStats: Record<string, { transactions: number; revenue: number; clients: Set<string> }> = {};
    filteredHighticket.forEach(d => {
      const ec = d.nama_ec || "Unknown";
      if (!ecStats[ec]) ecStats[ec] = { transactions: 0, revenue: 0, clients: new Set() };
      ecStats[ec].transactions++;
      if (d.status_payment === "Lunas" || d.status_payment === "Pelunasan") {
        ecStats[ec].revenue += Number(d.harga || 0);
      }
      const phone = normalizePhoneNumber(d.nohp);
      if (phone) ecStats[ec].clients.add(phone);
    });

    const ecPerformance = Object.entries(ecStats)
      .map(([ec, data]) => ({
        ec,
        transactions: data.transactions,
        revenue: data.revenue,
        clients: data.clients.size,
        avgValue: data.transactions > 0 ? data.revenue / data.transactions : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ===== TOP OUTSTANDING CLIENTS =====
    const outstandingByClient = outstandingTransactions.map(ht => {
      const targetAmount = ht.harga_bayar ? Number(ht.harga_bayar) : Number(ht.harga);
      const payments = paymentHistory?.filter(p => p.highticket_id === ht.id) || [];
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.jumlah_bayar), 0);
      const remaining = Math.max(0, targetAmount - totalPaid);
      const daysSinceTransaction = differenceInDays(today, new Date(ht.tanggal_transaksi));
      return {
        id: ht.id,
        nama: ht.nama,
        nohp: ht.nohp,
        program: ht.nama_program,
        status: ht.status_payment,
        remaining,
        days: daysSinceTransaction,
      };
    }).filter(c => c.remaining > 0).sort((a, b) => b.remaining - a.remaining).slice(0, 5);

    // ===== SH2M METRICS =====
    const totalTransactions = filteredSh2m.length;
    const paidTransactions = filteredSh2m.filter(d => d.status_payment === "paid").length;
    const paidRate = totalTransactions > 0 ? (paidTransactions / totalTransactions) * 100 : 0;

    // Unique clients (by normalized phone)
    const uniquePhones = new Set<string>();
    const phoneTransactions = new Map<string, any[]>();
    
    filteredSh2m.forEach(d => {
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

    // ===== SOURCE IKLAN PERFORMANCE (Top 10) =====
    const sourceStats = new Map<string, {
      total: number;
      paid: number;
      uniquePhones: Set<string>;
    }>();

    filteredSh2m.forEach(d => {
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
    const alerts: { type: "critical" | "warning"; message: string; count: number | string }[] = [];

    // High outstanding
    if (totalOutstanding > 50000000) {
      alerts.push({ type: "critical", message: "Outstanding receivables tinggi", count: formatCurrency(totalOutstanding) });
    } else if (totalOutstanding > 20000000) {
      alerts.push({ type: "warning", message: "Outstanding perlu diperhatikan", count: formatCurrency(totalOutstanding) });
    }

    // DP > 30 days
    const overdueDP = outstandingTransactions.filter(ht => {
      const daysSince = differenceInDays(today, new Date(ht.tanggal_transaksi));
      return daysSince > 30 && ht.status_payment === "DP";
    }).length;
    if (overdueDP > 0) {
      alerts.push({ type: "critical", message: "DP belum lunas > 30 hari", count: overdueDP });
    }

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

    if (emptyPhone > 0) alerts.push({ type: "critical", message: "Data dengan no HP kosong", count: emptyPhone });
    if (emptySource > 0) alerts.push({ type: "warning", message: "Data tanpa source iklan", count: emptySource });

    return {
      // Revenue Metrics
      totalRevenue,
      mtdRevenue,
      totalOutstanding,
      arpc,
      // Payment Status
      paymentStatusData,
      totalHighticket: filteredHighticket.length,
      // Branch Revenue
      branchRevenueData,
      // EC Performance
      ecPerformance,
      // Outstanding Clients
      outstandingByClient,
      // SH2M Metrics
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
      // Source Performance
      sourcePerformance,
      // Alerts
      alerts,
    };
  }, [filteredSh2m, filteredHighticket, sh2mData, highticketData, paymentHistory, categories]);

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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">CEO Command Center</h1>
            <p className="text-muted-foreground">Executive Dashboard - Semua Cabang</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((year) => (
                <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* A. Executive Summary - Revenue Focus */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Total Revenue</span>
            </div>
            <p className="text-xl font-bold mt-2 text-green-600">{formatCurrency(metrics?.totalRevenue || 0)}</p>
            <p className="text-xs text-muted-foreground">Lunas + Pelunasan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">MTD Revenue</span>
            </div>
            <p className="text-xl font-bold mt-2 text-blue-600">{formatCurrency(metrics?.mtdRevenue || 0)}</p>
            <p className="text-xs text-muted-foreground">Bulan ini</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Outstanding</span>
            </div>
            <p className="text-xl font-bold mt-2 text-orange-600">{formatCurrency(metrics?.totalOutstanding || 0)}</p>
            <p className="text-xs text-muted-foreground">Sisa cicilan</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">ARPC</span>
            </div>
            <p className="text-xl font-bold mt-2 text-purple-600">{formatCurrency(metrics?.arpc || 0)}</p>
            <p className="text-xs text-muted-foreground">Avg Revenue/Client</p>
          </CardContent>
        </Card>
      </div>

      {/* B. SH2M Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">SH2M Paid</span>
            </div>
            <p className="text-lg font-bold mt-1">{metrics?.paidTransactions.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics?.paidRate.toFixed(1)}% rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Unique Clients</span>
            </div>
            <p className="text-lg font-bold mt-1">{metrics?.uniqueClients.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Repeat Clients</span>
            </div>
            <p className="text-lg font-bold mt-1">{metrics?.repeatClients.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics?.repeatRate.toFixed(1)}%</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">High Value</span>
            </div>
            <p className="text-lg font-bold mt-1 text-amber-600">{metrics?.highValueClients.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Unpaid &gt;7d</span>
            </div>
            <p className="text-lg font-bold mt-1 text-red-600">{metrics?.unpaidOver7Days.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Data Trust</span>
            </div>
            <div className="mt-1">{metrics && getTrustBadge(metrics.trustScore)}</div>
          </CardContent>
        </Card>
      </div>

      {/* C. Revenue by Branch + Payment Status */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              Revenue by Branch
            </CardTitle>
            <CardDescription>Perbandingan revenue per cabang</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cabang</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics?.branchRevenueData.map((b) => (
                  <TableRow key={b.branch}>
                    <TableCell>
                      <Badge variant="outline">{b.branchLabel}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{b.total.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatCurrency(b.revenue)}</TableCell>
                    <TableCell className="text-right text-orange-600">{formatCurrency(b.outstanding)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold bg-muted/50">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{metrics?.totalHighticket.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">{formatCurrency(metrics?.totalRevenue || 0)}</TableCell>
                  <TableCell className="text-right text-orange-600">{formatCurrency(metrics?.totalOutstanding || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Percent className="h-5 w-5" />
              Payment Status Distribution
            </CardTitle>
            <CardDescription>Breakdown status pembayaran highticket</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics?.paymentStatusData || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {metrics?.paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => value.toLocaleString()} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* D. EC Performance + Outstanding Receivables */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5" />
              Top EC Performance
            </CardTitle>
            <CardDescription>Top 10 EC by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>EC Name</TableHead>
                  <TableHead className="text-right">Transaksi</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Avg</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics?.ecPerformance.map((ec, idx) => (
                  <TableRow key={ec.ec}>
                    <TableCell className="font-medium">{idx + 1}</TableCell>
                    <TableCell>{ec.ec}</TableCell>
                    <TableCell className="text-right">{ec.transactions}</TableCell>
                    <TableCell className="text-right font-semibold text-green-600">{formatCurrency(ec.revenue)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatCurrency(ec.avgValue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Receipt className="h-5 w-5 text-orange-500" />
              Top Outstanding Receivables
            </CardTitle>
            <CardDescription>Client dengan sisa tagihan tertinggi</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.outstandingByClient.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-500" />
                <p>Tidak ada outstanding</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Client</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sisa</TableHead>
                    <TableHead className="text-right">Hari</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.outstandingByClient.map((client) => (
                    <TableRow key={client.id}>
                      <TableCell className="max-w-[120px] truncate">{client.nama}</TableCell>
                      <TableCell>
                        <Badge variant={client.status === "DP" ? "default" : "secondary"}>{client.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">{formatCurrency(client.remaining)}</TableCell>
                      <TableCell className="text-right">
                        <span className={client.days > 30 ? "text-red-600 font-semibold" : ""}>
                          {client.days}d
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* E. Source Iklan Performance */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Top 10 Source Iklan Performance
          </CardTitle>
          <CardDescription>Source iklan dengan paid tertinggi (SH2M)</CardDescription>
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

      {/* F. Risk & Alert Panel */}
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
                    {typeof alert.count === "number" ? alert.count.toLocaleString() : alert.count}
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
