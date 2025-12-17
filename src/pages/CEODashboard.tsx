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
  DollarSign, Percent, UserCheck, CreditCard, Wallet, Receipt, Package,
  ArrowUp, ArrowDown, Minus, TrendingDown
} from "lucide-react";
import { format, startOfMonth, endOfMonth, differenceInDays, subDays, subMonths } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from "recharts";

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

type PeriodFilter = "full_month" | "last_week" | "last_month" | "all";

export default function CEODashboard() {
  const today = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("full_month");

  const getDateRange = () => {
    // Base date is the last day of selected month/year
    const selectedDate = new Date(selectedYear, selectedMonth + 1, 0); // Last day of selected month
    const monthStart = new Date(selectedYear, selectedMonth, 1);
    const monthEnd = new Date(selectedYear, selectedMonth + 1, 0);

    switch (periodFilter) {
      case "all":
        return { start: null, end: null };
      case "last_week":
        // Last 7 days from end of selected month
        return { start: subDays(monthEnd, 6), end: monthEnd };
      case "last_month":
        // Full selected month (same as full_month but labeled differently)
        return { start: monthStart, end: monthEnd };
      case "full_month":
      default:
        return { start: monthStart, end: monthEnd };
    }
  };

  // Helper function to fetch all data with pagination (Supabase has 1000 row limit)
  const fetchAllPaginated = async (
    tableName: "sh2m_data" | "highticket_data" | "payment_history" | "source_iklan_categories",
    orderBy?: { column: string; ascending: boolean }
  ) => {
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from(tableName)
        .select("*")
        .range(from, from + PAGE_SIZE - 1);
      
      if (orderBy) {
        query = query.order(orderBy.column, { ascending: orderBy.ascending });
      }

      const { data, error } = await query;
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
  };

  // Fetch all SH2M data with pagination
  const { data: sh2mData, isLoading: loadingSh2m } = useQuery({
    queryKey: ["ceo-dashboard-sh2m"],
    queryFn: async () => {
      return fetchAllPaginated("sh2m_data", { column: "tanggal", ascending: false });
    },
  });

  // Fetch all Highticket data with pagination
  const { data: highticketData, isLoading: loadingHighticket } = useQuery({
    queryKey: ["ceo-dashboard-highticket"],
    queryFn: async () => {
      return fetchAllPaginated("highticket_data", { column: "tanggal_transaksi", ascending: false });
    },
  });

  // Fetch payment history with pagination
  const { data: paymentHistory } = useQuery({
    queryKey: ["ceo-dashboard-payments"],
    queryFn: async () => {
      return fetchAllPaginated("payment_history");
    },
  });

  // Fetch source categories with pagination
  const { data: categories } = useQuery({
    queryKey: ["ceo-dashboard-categories"],
    queryFn: async () => {
      return fetchAllPaginated("source_iklan_categories");
    },
  });

  const isLoading = loadingSh2m || loadingHighticket;

  // Filter data by date range
  const filteredSh2m = useMemo(() => {
    if (!sh2mData) return [];
    const range = getDateRange();
    if (!range.start || !range.end) return sh2mData; // Return all if "all" selected
    
    return sh2mData.filter(d => {
      const recordDate = new Date(d.tanggal);
      return recordDate >= range.start! && recordDate <= range.end!;
    });
  }, [sh2mData, selectedMonth, selectedYear, periodFilter]);

  const filteredHighticket = useMemo(() => {
    if (!highticketData) return [];
    const range = getDateRange();
    if (!range.start || !range.end) return highticketData; // Return all if "all" selected
    
    return highticketData.filter(d => {
      const recordDate = new Date(d.tanggal_transaksi);
      return recordDate >= range.start! && recordDate <= range.end!;
    });
  }, [highticketData, selectedMonth, selectedYear, periodFilter]);

  // Calculate all metrics
  const metrics = useMemo(() => {
    if (!sh2mData || !highticketData) return null;

    const categoriesMap = new Map(categories?.map(c => [c.source_iklan, c.kategori]) || []);
    const categorizedSources = new Set(categories?.filter(c => c.kategori)?.map(c => c.source_iklan) || []);

    // ===== REVENUE METRICS FROM HIGHTICKET =====
    // Total Revenue (ALL transactions)
    const totalRevenue = highticketData.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // MTD Revenue (ALL transactions)
    const mtdStart = startOfMonth(today);
    const mtdEnd = endOfMonth(today);
    const mtdTransactions = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date >= mtdStart && date <= mtdEnd;
    });
    const mtdRevenue = mtdTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // ===== MoM GROWTH CALCULATION =====
    // Previous month revenue (ALL transactions)
    const prevMonthStart = startOfMonth(subMonths(today, 1));
    const prevMonthEnd = endOfMonth(subMonths(today, 1));
    const prevMonthTransactions = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date >= prevMonthStart && date <= prevMonthEnd;
    });
    const prevMonthRevenue = prevMonthTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // Calculate MoM Growth Rate
    const momGrowthRate = prevMonthRevenue > 0 
      ? ((mtdRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 
      : mtdRevenue > 0 ? 100 : 0;

    // MoM Growth per Branch
    const mtdBekasi = mtdTransactions.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const mtdJogja = mtdTransactions.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const prevBekasi = prevMonthTransactions.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const prevJogja = prevMonthTransactions.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    
    const momGrowthBekasi = prevBekasi > 0 ? ((mtdBekasi - prevBekasi) / prevBekasi) * 100 : mtdBekasi > 0 ? 100 : 0;
    const momGrowthJogja = prevJogja > 0 ? ((mtdJogja - prevJogja) / prevJogja) * 100 : mtdJogja > 0 ? 100 : 0;

    // Transaction count MoM
    const mtdTransactionCount = mtdTransactions.length;
    const prevTransactionCount = prevMonthTransactions.length;
    const momGrowthTransactions = prevTransactionCount > 0 
      ? ((mtdTransactionCount - prevTransactionCount) / prevTransactionCount) * 100 
      : mtdTransactionCount > 0 ? 100 : 0;

    // ===== YoY GROWTH CALCULATION =====
    // Selected month this year (ALL transactions)
    const selectedMonthStart = new Date(selectedYear, selectedMonth, 1);
    const selectedMonthEnd = new Date(selectedYear, selectedMonth + 1, 0);
    const selectedMonthTransactions = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date >= selectedMonthStart && date <= selectedMonthEnd;
    });
    const selectedMonthRevenue = selectedMonthTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // Same month last year (ALL transactions)
    const lastYearStart = new Date(selectedYear - 1, selectedMonth, 1);
    const lastYearEnd = new Date(selectedYear - 1, selectedMonth + 1, 0);
    const lastYearTransactions = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date >= lastYearStart && date <= lastYearEnd;
    });
    const lastYearRevenue = lastYearTransactions.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    // Calculate YoY Growth Rate
    const yoyGrowthRate = lastYearRevenue > 0 
      ? ((selectedMonthRevenue - lastYearRevenue) / lastYearRevenue) * 100 
      : selectedMonthRevenue > 0 ? 100 : 0;

    // YoY Growth per Branch - Selected month
    const selectedBekasi = selectedMonthTransactions.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const selectedJogja = selectedMonthTransactions.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const lastYearBekasi = lastYearTransactions.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const lastYearJogja = lastYearTransactions.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    
    const yoyGrowthBekasi = lastYearBekasi > 0 ? ((selectedBekasi - lastYearBekasi) / lastYearBekasi) * 100 : selectedBekasi > 0 ? 100 : 0;
    const yoyGrowthJogja = lastYearJogja > 0 ? ((selectedJogja - lastYearJogja) / lastYearJogja) * 100 : selectedJogja > 0 ? 100 : 0;

    // YoY Transaction count
    const selectedTransactionCount = selectedMonthTransactions.length;
    const lastYearTransactionCount = lastYearTransactions.length;
    const yoyGrowthTransactions = lastYearTransactionCount > 0 
      ? ((selectedTransactionCount - lastYearTransactionCount) / lastYearTransactionCount) * 100 
      : selectedTransactionCount > 0 ? 100 : 0;

    // Full year comparison (ALL transactions)
    const currentYearData = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date.getFullYear() === selectedYear;
    });
    const currentYearRevenue = currentYearData.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    const previousYearData = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date.getFullYear() === selectedYear - 1;
    });
    const previousYearRevenue = previousYearData.reduce((sum, d) => sum + Number(d.harga || 0), 0);

    const yoyFullYearGrowth = previousYearRevenue > 0 
      ? ((currentYearRevenue - previousYearRevenue) / previousYearRevenue) * 100 
      : currentYearRevenue > 0 ? 100 : 0;

    // Full year branch comparison
    const currentYearBekasi = currentYearData.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const currentYearJogja = currentYearData.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const previousYearBekasi = previousYearData.filter(d => d.asal_iklan?.includes("Bekasi")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    const previousYearJogja = previousYearData.filter(d => d.asal_iklan?.includes("Jogja")).reduce((sum, d) => sum + Number(d.harga || 0), 0);
    
    const yoyFullYearBekasi = previousYearBekasi > 0 ? ((currentYearBekasi - previousYearBekasi) / previousYearBekasi) * 100 : currentYearBekasi > 0 ? 100 : 0;
    const yoyFullYearJogja = previousYearJogja > 0 ? ((currentYearJogja - previousYearJogja) / previousYearJogja) * 100 : currentYearJogja > 0 ? 100 : 0;

    // Full year transaction count
    const currentYearTransCount = currentYearData.length;
    const previousYearTransCount = previousYearData.length;
    const yoyFullYearTransactions = previousYearTransCount > 0 
      ? ((currentYearTransCount - previousYearTransCount) / previousYearTransCount) * 100 
      : currentYearTransCount > 0 ? 100 : 0;

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

    // ===== EC PERFORMANCE BY BRANCH (Line Chart Data) =====
    // Jogja EC names
    const ecNamesJogja = ["Farah", "Intan", "Rizki", "Sefhia", "Yola"];
    
    // Initialize EC stats for Jogja
    const ecRevenueJogja: Record<string, number> = {};
    ecNamesJogja.forEach(ec => {
      ecRevenueJogja[ec] = 0;
    });

    filteredHighticket.forEach(d => {
      const ec = d.nama_ec || "";
      const branch = d.asal_iklan || "";
      const isPaid = d.status_payment === "Lunas" || d.status_payment === "Pelunasan";
      const revenue = isPaid ? Number(d.harga || 0) : 0;

      if (ecNamesJogja.includes(ec) && branch.includes("Jogja")) {
        ecRevenueJogja[ec] += revenue;
      }
    });

    // Format for line chart - Jogja only
    const ecRevenueChartJogja = ecNamesJogja.map(ec => ({
      ec,
      Revenue: ecRevenueJogja[ec],
    }));

    // ===== PRODUCT PERFORMANCE BY CATEGORY =====
    const productStats: Record<string, { 
      transactions: number; 
      revenue: number; 
      category: string;
    }> = {};

    filteredHighticket.forEach(d => {
      const product = d.nama_program || "Unknown";
      const category = d.category || "Program";
      if (!productStats[product]) {
        productStats[product] = { transactions: 0, revenue: 0, category };
      }
      productStats[product].transactions++;
      if (d.status_payment === "Lunas" || d.status_payment === "Pelunasan") {
        productStats[product].revenue += Number(d.harga || 0);
      }
    });

    const allProductPerformance = Object.entries(productStats)
      .map(([product, data]) => ({
        product,
        ...data,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Top products combined
    const topProductsAll = allProductPerformance.slice(0, 10);

    // Top products by category
    const topProductsProgram = allProductPerformance
      .filter(p => p.category === "Program")
      .slice(0, 10);

    const topProductsMerchandise = allProductPerformance
      .filter(p => p.category === "Merchandise")
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
      // MoM Growth
      momGrowthRate,
      momGrowthBekasi,
      momGrowthJogja,
      momGrowthTransactions,
      prevMonthRevenue,
      // YoY Growth (Monthly)
      yoyGrowthRate,
      yoyGrowthBekasi,
      yoyGrowthJogja,
      yoyGrowthTransactions,
      lastYearRevenue,
      selectedMonthRevenue,
      // YoY Growth (Full Year)
      currentYearRevenue,
      previousYearRevenue,
      yoyFullYearGrowth,
      yoyFullYearBekasi,
      yoyFullYearJogja,
      yoyFullYearTransactions,
      // Payment Status
      paymentStatusData,
      totalHighticket: filteredHighticket.length,
      // Branch Revenue
      branchRevenueData,
      // EC Performance
      ecPerformance,
      ecRevenueChartJogja,
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
      // Product Performance
      topProductsAll,
      topProductsProgram,
      topProductsMerchandise,
      // Alerts
      alerts,
    };
  }, [filteredSh2m, filteredHighticket, sh2mData, highticketData, paymentHistory, categories]);

  // Calculate yearly revenue trend by branch
  const yearlyRevenueTrend = useMemo(() => {
    if (!highticketData) return [];

    // Filter data for selected year and paid status
    const yearData = highticketData.filter(d => {
      const date = new Date(d.tanggal_transaksi);
      return date.getFullYear() === selectedYear && 
        (d.status_payment === "Lunas" || d.status_payment === "Pelunasan");
    });

    // Initialize monthly data
    const monthlyData: Record<number, { bekasi: number; jogja: number }> = {};
    for (let i = 0; i < 12; i++) {
      monthlyData[i] = { bekasi: 0, jogja: 0 };
    }

    // Aggregate revenue by month and branch
    yearData.forEach(d => {
      const month = new Date(d.tanggal_transaksi).getMonth();
      const branch = d.asal_iklan || "";
      const revenue = Number(d.harga || 0);

      if (branch.includes("Bekasi")) {
        monthlyData[month].bekasi += revenue;
      } else if (branch.includes("Jogja")) {
        monthlyData[month].jogja += revenue;
      }
    });

    // Convert to array format for chart
    return monthNames.map((name, index) => ({
      month: name.substring(0, 3), // Short month name
      Bekasi: monthlyData[index].bekasi,
      Jogja: monthlyData[index].jogja,
      Total: monthlyData[index].bekasi + monthlyData[index].jogja,
    }));
  }, [highticketData, selectedYear]);

  // Calculate all-time monthly revenue trend (all years) comparing Bekasi vs Jogja
  const allTimeMonthlyTrend = useMemo(() => {
    if (!highticketData) return [];

    // Get min and max dates from data
    const dates = highticketData
      .map(d => new Date(d.tanggal_transaksi))
      .filter(d => !isNaN(d.getTime()));
    
    if (dates.length === 0) return [];

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Generate all months between min and max
    const months: { year: number; month: number }[] = [];
    let current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

    while (current <= end) {
      months.push({ year: current.getFullYear(), month: current.getMonth() });
      current.setMonth(current.getMonth() + 1);
    }

    // Initialize data structure
    const monthlyData: Record<string, { bekasi: number; jogja: number }> = {};
    months.forEach(m => {
      const key = `${m.year}-${m.month}`;
      monthlyData[key] = { bekasi: 0, jogja: 0 };
    });

    // Aggregate revenue by month and branch
    highticketData.forEach(d => {
      const date = new Date(d.tanggal_transaksi);
      if (isNaN(date.getTime())) return;
      
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const branch = d.asal_iklan || "";
      const revenue = Number(d.harga || 0);

      if (monthlyData[key]) {
        if (branch.includes("Bekasi")) {
          monthlyData[key].bekasi += revenue;
        } else if (branch.includes("Jogja")) {
          monthlyData[key].jogja += revenue;
        }
      }
    });

    // Convert to array format for chart
    return months.map(m => {
      const key = `${m.year}-${m.month}`;
      const shortMonth = monthNames[m.month].substring(0, 3);
      return {
        label: `${shortMonth} ${m.year}`,
        Bekasi: monthlyData[key].bekasi,
        Jogja: monthlyData[key].jogja,
        Total: monthlyData[key].bekasi + monthlyData[key].jogja,
      };
    });
  }, [highticketData]);

  const getTrustBadge = (score: number) => {
    if (score >= 90) return <Badge className="bg-green-500 text-white"><CheckCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
    if (score >= 70) return <Badge className="bg-yellow-500 text-white"><AlertCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
    return <Badge className="bg-red-500 text-white"><XCircle className="h-3 w-3 mr-1" />{score.toFixed(0)}%</Badge>;
  };

  // Growth Trend Indicator
  const getGrowthIndicator = (growth: number, size: "sm" | "lg" = "sm") => {
    const iconSize = size === "lg" ? "h-5 w-5" : "h-4 w-4";
    const textSize = size === "lg" ? "text-lg font-bold" : "text-xs font-medium";
    
    if (growth > 10) {
      return (
        <div className={`flex items-center gap-1 text-green-600 ${textSize}`}>
          <ArrowUp className={iconSize} />
          <ArrowUp className={`${iconSize} -ml-3`} />
          <span>+{growth.toFixed(1)}%</span>
        </div>
      );
    }
    if (growth > 0) {
      return (
        <div className={`flex items-center gap-1 text-green-600 ${textSize}`}>
          <ArrowUp className={iconSize} />
          <span>+{growth.toFixed(1)}%</span>
        </div>
      );
    }
    if (growth >= -1 && growth <= 1) {
      return (
        <div className={`flex items-center gap-1 text-yellow-600 ${textSize}`}>
          <Minus className={iconSize} />
          <span>{growth.toFixed(1)}%</span>
        </div>
      );
    }
    if (growth >= -10) {
      return (
        <div className={`flex items-center gap-1 text-red-600 ${textSize}`}>
          <ArrowDown className={iconSize} />
          <span>{growth.toFixed(1)}%</span>
        </div>
      );
    }
    return (
      <div className={`flex items-center gap-1 text-red-600 ${textSize}`}>
        <ArrowDown className={iconSize} />
        <ArrowDown className={`${iconSize} -ml-3`} />
        <span>{growth.toFixed(1)}%</span>
      </div>
    );
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
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as PeriodFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_month">Bulan Penuh</SelectItem>
              <SelectItem value="last_week">1 Minggu Terakhir</SelectItem>
              <SelectItem value="last_month">1 Bulan Terakhir</SelectItem>
              <SelectItem value="all">Semua Data</SelectItem>
            </SelectContent>
          </Select>
          <Select 
            value={selectedMonth.toString()} 
            onValueChange={(v) => setSelectedMonth(parseInt(v))}
            disabled={periodFilter === "all"}
          >
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Pilih Bulan" />
            </SelectTrigger>
            <SelectContent>
              {monthNames.map((month, index) => (
                <SelectItem key={index} value={index.toString()}>{month}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select 
            value={selectedYear.toString()} 
            onValueChange={(v) => setSelectedYear(parseInt(v))}
            disabled={periodFilter === "all"}
          >
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
            <p className="text-xs text-muted-foreground">Semua transaksi</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">MTD Revenue</span>
            </div>
            <p className="text-xl font-bold mt-2 text-blue-600">{formatCurrency(metrics?.mtdRevenue || 0)}</p>
            <div className="flex items-center gap-2 mt-1">
              {metrics && getGrowthIndicator(metrics.momGrowthRate)}
              <span className="text-xs text-muted-foreground">vs bulan lalu</span>
            </div>
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

      {/* MoM Growth Summary Card */}
      <Card className="border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <TrendingUp className="h-5 w-5 text-primary" />
            MoM Growth Summary
          </CardTitle>
          <CardDescription>Perbandingan pertumbuhan bulan ini vs bulan lalu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Overall Growth */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Revenue Growth</p>
              {metrics && getGrowthIndicator(metrics.momGrowthRate, "lg")}
              <p className="text-xs text-muted-foreground mt-2">
                {formatCurrency(metrics?.prevMonthRevenue || 0)} → {formatCurrency(metrics?.mtdRevenue || 0)}
              </p>
            </div>
            
            {/* Bekasi Growth */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Bekasi</p>
              {metrics && getGrowthIndicator(metrics.momGrowthBekasi, "lg")}
              <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">Bekasi</Badge>
            </div>
            
            {/* Jogja Growth */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Jogja</p>
              {metrics && getGrowthIndicator(metrics.momGrowthJogja, "lg")}
              <Badge variant="outline" className="mt-2 text-green-600 border-green-300">Jogja</Badge>
            </div>
            
            {/* Transaction Growth */}
            <div className="p-4 rounded-lg bg-background border">
              <p className="text-sm text-muted-foreground mb-2">Transaksi</p>
              {metrics && getGrowthIndicator(metrics.momGrowthTransactions, "lg")}
              <p className="text-xs text-muted-foreground mt-2">Jumlah transaksi paid</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* YoY Growth Summary Card - 2 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Section 1: Monthly YoY */}
        <Card className="border-2 border-amber-500/20 bg-gradient-to-r from-amber-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-amber-500" />
              YoY Growth - Bulanan
            </CardTitle>
            <CardDescription>
              {monthNames[selectedMonth]} {selectedYear} vs {monthNames[selectedMonth]} {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Overall YoY Growth */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Revenue</p>
                {metrics && getGrowthIndicator(metrics.yoyGrowthRate, "lg")}
                <p className="text-xs text-muted-foreground mt-2">
                  {formatCurrency(metrics?.lastYearRevenue || 0)} → {formatCurrency(metrics?.selectedMonthRevenue || 0)}
                </p>
              </div>
              
              {/* Transaction YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Transaksi</p>
                {metrics && getGrowthIndicator(metrics.yoyGrowthTransactions, "lg")}
                <p className="text-xs text-muted-foreground mt-2">Jumlah transaksi paid</p>
              </div>
              
              {/* Bekasi YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Bekasi</p>
                {metrics && getGrowthIndicator(metrics.yoyGrowthBekasi, "lg")}
                <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">Bekasi</Badge>
              </div>
              
              {/* Jogja YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Jogja</p>
                {metrics && getGrowthIndicator(metrics.yoyGrowthJogja, "lg")}
                <Badge variant="outline" className="mt-2 text-green-600 border-green-300">Jogja</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Full Year YoY */}
        <Card className="border-2 border-cyan-500/20 bg-gradient-to-r from-cyan-500/5 to-transparent">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5 text-cyan-500" />
              YoY Growth - Tahunan
            </CardTitle>
            <CardDescription>
              Full Year {selectedYear} vs Full Year {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {/* Overall Full Year Growth */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Revenue</p>
                {metrics && getGrowthIndicator(metrics.yoyFullYearGrowth, "lg")}
                <p className="text-xs text-muted-foreground mt-2">
                  {formatCurrency(metrics?.previousYearRevenue || 0)} → {formatCurrency(metrics?.currentYearRevenue || 0)}
                </p>
              </div>
              
              {/* Transaction Full Year YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Transaksi</p>
                {metrics && getGrowthIndicator(metrics.yoyFullYearTransactions, "lg")}
                <p className="text-xs text-muted-foreground mt-2">Jumlah transaksi paid</p>
              </div>
              
              {/* Bekasi Full Year YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Bekasi</p>
                {metrics && getGrowthIndicator(metrics.yoyFullYearBekasi, "lg")}
                <Badge variant="outline" className="mt-2 text-blue-600 border-blue-300">Bekasi</Badge>
              </div>
              
              {/* Jogja Full Year YoY */}
              <div className="p-4 rounded-lg bg-background border">
                <p className="text-sm text-muted-foreground mb-2">Jogja</p>
                {metrics && getGrowthIndicator(metrics.yoyFullYearJogja, "lg")}
                <Badge variant="outline" className="mt-2 text-green-600 border-green-300">Jogja</Badge>
              </div>
            </div>
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

      {/* Revenue Trend - Full Year by Branch */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Revenue Trend {selectedYear} - Per Cabang
          </CardTitle>
          <CardDescription>Perjalanan revenue bulanan Bekasi vs Jogja</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yearlyRevenueTrend} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Bulan: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Bekasi" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Jogja" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Total" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* All-Time Monthly Revenue Trend - Bekasi vs Jogja */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Perjalanan Revenue Bulanan - Semua Tahun
          </CardTitle>
          <CardDescription>Trend revenue bulanan Bekasi vs Jogja dari awal hingga sekarang</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={allTimeMonthlyTrend} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  tick={{ fontSize: 10 }} 
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={Math.ceil(allTimeMonthlyTrend.length / 12)}
                />
                <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                <Tooltip 
                  formatter={(value: number) => formatCurrency(value)}
                  labelFormatter={(label) => `Periode: ${label}`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="Bekasi" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Jogja" 
                  stroke="#22c55e" 
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  type="monotone" 
                  dataKey="Total" 
                  stroke="#8b5cf6" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

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

      {/* EC Revenue per Branch - Separate Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Bekasi EC - Placeholder */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Revenue per EC - Bekasi
            </CardTitle>
            <CardDescription>Total revenue per EC cabang Bekasi</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-30" />
                <p>Data EC Bekasi belum tersedia</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Jogja EC */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCheck className="h-5 w-5 text-green-500" />
              Revenue per EC - Jogja
            </CardTitle>
            <CardDescription>Total revenue per EC (Farah, Intan, Rizki, Sefhia, Yola)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics?.ecRevenueChartJogja || []} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="ec" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `EC: ${label}`}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="Revenue" 
                    stroke="#22c55e" 
                    strokeWidth={2}
                    dot={{ r: 5, fill: "#22c55e" }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* E. Top Product Performance */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* All Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              Top Product (Semua)
            </CardTitle>
            <CardDescription>Gabungan Program & Merchandise</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={metrics?.topProductsAll || []} 
                  layout="vertical"
                  margin={{ left: 10, right: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                  <YAxis 
                    type="category" 
                    dataKey="product" 
                    width={100} 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Product: ${label}`}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Program Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-blue-500" />
              Top Product (Program)
            </CardTitle>
            <CardDescription>Kategori Program saja</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.topProductsProgram.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Tidak ada data Program
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={metrics?.topProductsProgram || []} 
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <YAxis 
                      type="category" 
                      dataKey="product" 
                      width={100} 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Product: ${label}`}
                    />
                    <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Merchandise Products */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-amber-500" />
              Top Product (Merchandise)
            </CardTitle>
            <CardDescription>Kategori Merchandise saja</CardDescription>
          </CardHeader>
          <CardContent>
            {metrics?.topProductsMerchandise.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                Tidak ada data Merchandise
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={metrics?.topProductsMerchandise || []} 
                    layout="vertical"
                    margin={{ left: 10, right: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000000).toFixed(0)}jt`} />
                    <YAxis 
                      type="category" 
                      dataKey="product" 
                      width={100} 
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => v.length > 15 ? v.substring(0, 15) + '...' : v}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      labelFormatter={(label) => `Product: ${label}`}
                    />
                    <Bar dataKey="revenue" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* F. Source Iklan Performance */}
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
