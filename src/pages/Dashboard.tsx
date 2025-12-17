import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBranch } from "@/contexts/BranchContext";
import { DollarSign, TrendingUp, TrendingDown, BarChart3, Calendar, CreditCard, Receipt, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfYear, 
  endOfYear, 
  setMonth, 
  setYear,
  eachDayOfInterval,
  eachWeekOfInterval,
  eachMonthOfInterval,
  startOfWeek,
  endOfWeek,
  getWeek,
  parseISO,
} from "date-fns";
import { id } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
  LabelList,
  ReferenceLine,
  ReferenceDot,
} from "recharts";

// Helper function to fetch all paginated data from Supabase
async function fetchAllPaginated<T>(
  queryBuilder: () => ReturnType<typeof supabase.from>,
  selectColumns: string,
  filters?: {
    branchFilter?: string | null;
    dateRange?: { start: string; end: string };
    statusFilter?: string[];
  }
): Promise<T[]> {
  let allData: T[] = [];
  let page = 0;
  const pageSize = 1000;
  let hasMore = true;
  
  while (hasMore) {
    let query = queryBuilder()
      .select(selectColumns)
      .range(page * pageSize, (page + 1) * pageSize - 1);
    
    if (filters?.branchFilter) {
      query = query.eq("asal_iklan", filters.branchFilter);
    }
    
    if (filters?.dateRange) {
      query = query
        .gte("tanggal_transaksi", filters.dateRange.start)
        .lte("tanggal_transaksi", filters.dateRange.end);
    }
    
    if (filters?.statusFilter) {
      query = query.in("status_payment", filters.statusFilter);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (data && data.length > 0) {
      allData = [...allData, ...data as T[]];
      hasMore = data.length === pageSize;
      page++;
    } else {
      hasMore = false;
    }
  }
  
  return allData;
}

export default function Dashboard() {
  const { getBranchFilter, selectedBranch } = useBranch();
  const branchFilter = getBranchFilter();
  
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const selectedDate = setYear(setMonth(new Date(), selectedMonth), selectedYear);
  const monthStartDate = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
  const monthEndDate = format(endOfMonth(selectedDate), 'yyyy-MM-dd');
  const yearStartDate = format(startOfYear(selectedDate), 'yyyy-MM-dd');
  const yearEndDate = format(endOfYear(selectedDate), 'yyyy-MM-dd');
  
  const months = [
    { value: 0, label: "Januari" },
    { value: 1, label: "Februari" },
    { value: 2, label: "Maret" },
    { value: 3, label: "April" },
    { value: 4, label: "Mei" },
    { value: 5, label: "Juni" },
    { value: 6, label: "Juli" },
    { value: 7, label: "Agustus" },
    { value: 8, label: "September" },
    { value: 9, label: "Oktober" },
    { value: 10, label: "November" },
    { value: 11, label: "Desember" },
  ];
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  // Get SH2M Revenue (All Time for this branch)
  const { data: sh2mRevenueData } = useQuery({
    queryKey: ["dashboard-sh2m-revenue", branchFilter],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("sh2m_revenue")
          .select("omset, tahun, bulan, nama_cs")
          .range(from, from + PAGE_SIZE - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
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
      
      const totalOmset = allData.reduce((sum, d) => sum + (d.omset || 0), 0);
      return { totalOmset, data: allData };
    },
  });

  // Get Highticket Revenue (All Time for this branch) - ALL transactions regardless of status
  const { data: highticketRevenue } = useQuery({
    queryKey: ["dashboard-highticket-revenue", branchFilter],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("highticket_data")
          .select("harga")
          .range(from, from + PAGE_SIZE - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
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
      
      return allData.reduce((sum, d) => sum + (d.harga || 0), 0);
    },
  });

  // Combined Total Revenue (Highticket + SH2M)
  const totalRevenue = (highticketRevenue || 0) + (sh2mRevenueData?.totalOmset || 0);

  // Get SH2M Revenue for selected month
  const { data: sh2mMonthlyRevenue } = useQuery({
    queryKey: ["dashboard-sh2m-monthly", branchFilter, selectedMonth, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("sh2m_revenue")
        .select("omset, nama_cs")
        .eq("tahun", selectedYear)
        .eq("bulan", selectedMonth + 1); // Database uses 1-12 for months
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const total = (data || []).reduce((sum, d) => sum + (d.omset || 0), 0);
      
      // Group by CS name
      const byCs: Record<string, number> = {};
      (data || []).forEach(d => {
        const cs = d.nama_cs || 'Unknown';
        byCs[cs] = (byCs[cs] || 0) + (d.omset || 0);
      });
      
      return { total, byCs, count: data?.length || 0 };
    },
  });

  // Get Total Harga Bayar (DP/Angsuran transactions) - with pagination
  const { data: dpMetrics } = useQuery({
    queryKey: ["dashboard-dp-metrics", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const data = await fetchAllPaginated<{ harga: number; harga_bayar: number | null; status_payment: string }>(
        () => supabase.from("highticket_data"),
        "harga, harga_bayar, status_payment",
        { 
          branchFilter, 
          dateRange: { start: monthStartDate, end: monthEndDate },
          statusFilter: ["DP", "Angsuran"]
        }
      );
      
      const totalHargaBayar = data.reduce((sum, d) => sum + (d.harga_bayar || 0), 0);
      const totalHarga = data.reduce((sum, d) => sum + (d.harga || 0), 0);
      const count = data.length;
      
      return { totalHargaBayar, totalHarga, count };
    },
  });

  // Get Monthly Revenue for the selected year (for monthly chart) - with pagination
  const { data: monthlyRevenueData } = useQuery({
    queryKey: ["dashboard-monthly-revenue", branchFilter, selectedYear],
    queryFn: async () => {
      const data = await fetchAllPaginated<{ tanggal_transaksi: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "tanggal_transaksi, harga",
        { 
          branchFilter, 
          dateRange: { start: yearStartDate, end: yearEndDate }
        }
      );

      // Group by month
      const monthlyData: Record<number, { revenue: number; transactions: number }> = {};
      for (let i = 0; i < 12; i++) {
        monthlyData[i] = { revenue: 0, transactions: 0 };
      }

      data.forEach(tx => {
        const month = parseISO(tx.tanggal_transaksi).getMonth();
        monthlyData[month].revenue += tx.harga || 0;
        monthlyData[month].transactions++;
      });

      return months.map(m => ({
        name: m.label.substring(0, 3),
        revenue: monthlyData[m.value].revenue,
        transactions: monthlyData[m.value].transactions,
      }));
    },
  });

  // Get Weekly Revenue for the selected month (for weekly chart) - with pagination
  const { data: weeklyRevenueData } = useQuery({
    queryKey: ["dashboard-weekly-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const weeks = eachWeekOfInterval(
        { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) },
        { weekStartsOn: 1 }
      );

      const data = await fetchAllPaginated<{ tanggal_transaksi: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "tanggal_transaksi, harga",
        { 
          branchFilter, 
          dateRange: { start: monthStartDate, end: monthEndDate }
        }
      );

      return weeks.map((weekStart, i) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekRevenue = data.filter(tx => {
          const txDate = parseISO(tx.tanggal_transaksi);
          return txDate >= weekStart && txDate <= weekEnd;
        }).reduce((sum, tx) => sum + (tx.harga || 0), 0);
        
        const weekTransactions = data.filter(tx => {
          const txDate = parseISO(tx.tanggal_transaksi);
          return txDate >= weekStart && txDate <= weekEnd;
        }).length;

        return {
          name: `Minggu ${i + 1}`,
          revenue: weekRevenue,
          transactions: weekTransactions,
        };
      });
    },
  });

  // Get Daily Revenue for the selected month (for daily chart) - with pagination
  const { data: dailyRevenueData } = useQuery({
    queryKey: ["dashboard-daily-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });

      const data = await fetchAllPaginated<{ tanggal_transaksi: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "tanggal_transaksi, harga",
        { 
          branchFilter, 
          dateRange: { start: monthStartDate, end: monthEndDate }
        }
      );

      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayRevenue = data.filter(tx => tx.tanggal_transaksi === dayStr)
          .reduce((sum, tx) => sum + (tx.harga || 0), 0);

        return {
          name: format(day, 'd'),
          revenue: dayRevenue,
        };
      });
    },
  });

  // Get Sales Trend by EC (revenue per EC for selected month) - with pagination
  const { data: salesTrendData } = useQuery({
    queryKey: ["dashboard-sales-trend", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const data = await fetchAllPaginated<{ nama_ec: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "nama_ec, harga",
        { 
          branchFilter, 
          dateRange: { start: monthStartDate, end: monthEndDate }
        }
      );

      // Group by EC name
      const ecRevenue: Record<string, number> = {};
      data.forEach(tx => {
        const ec = tx.nama_ec || 'Tidak Ada EC';
        if (!ecRevenue[ec]) {
          ecRevenue[ec] = 0;
        }
        ecRevenue[ec] += tx.harga || 0;
      });

      return Object.entries(ecRevenue)
        .map(([name, revenue]) => ({ name, revenue }))
        .sort((a, b) => b.revenue - a.revenue);
    },
  });

  // Get monthly revenue for selected month - ALL transactions
  const { data: currentMonthRevenue } = useQuery({
    queryKey: ["dashboard-current-month-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase
          .from("highticket_data")
          .select("harga")
          .gte("tanggal_transaksi", monthStartDate)
          .lte("tanggal_transaksi", monthEndDate)
          .range(from, from + PAGE_SIZE - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
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
      
      return allData.reduce((sum, d) => sum + (d.harga || 0), 0);
    },
  });

  // Get YoY comparison data (current year vs previous year monthly revenue)
  const previousYear = selectedYear - 1;
  const prevYearStartDate = format(startOfYear(setYear(new Date(), previousYear)), 'yyyy-MM-dd');
  const prevYearEndDate = format(endOfYear(setYear(new Date(), previousYear)), 'yyyy-MM-dd');

  const { data: yoyComparisonData } = useQuery({
    queryKey: ["dashboard-yoy-comparison", branchFilter, selectedYear],
    queryFn: async () => {
      // Fetch current year data
      const currentYearData = await fetchAllPaginated<{ tanggal_transaksi: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "tanggal_transaksi, harga",
        { 
          branchFilter, 
          dateRange: { start: yearStartDate, end: yearEndDate }
        }
      );

      // Fetch previous year data
      const prevYearData = await fetchAllPaginated<{ tanggal_transaksi: string; harga: number }>(
        () => supabase.from("highticket_data"),
        "tanggal_transaksi, harga",
        { 
          branchFilter, 
          dateRange: { start: prevYearStartDate, end: prevYearEndDate }
        }
      );

      // Group by month for both years
      const currentYearMonthly: Record<number, number> = {};
      const prevYearMonthly: Record<number, number> = {};
      
      for (let i = 0; i < 12; i++) {
        currentYearMonthly[i] = 0;
        prevYearMonthly[i] = 0;
      }

      currentYearData.forEach(tx => {
        const month = parseISO(tx.tanggal_transaksi).getMonth();
        currentYearMonthly[month] += tx.harga || 0;
      });

      prevYearData.forEach(tx => {
        const month = parseISO(tx.tanggal_transaksi).getMonth();
        prevYearMonthly[month] += tx.harga || 0;
      });

      return months.map(m => ({
        name: m.label.substring(0, 3),
        [selectedYear]: currentYearMonthly[m.value],
        [previousYear]: prevYearMonthly[m.value],
        growth: prevYearMonthly[m.value] > 0 
          ? ((currentYearMonthly[m.value] - prevYearMonthly[m.value]) / prevYearMonthly[m.value] * 100).toFixed(1)
          : currentYearMonthly[m.value] > 0 ? '∞' : '0',
      }));
    },
  });

  // Get Monthly Revenue for ALL BRANCHES (for monthly table display)
  const { data: allBranchMonthlyData } = useQuery({
    queryKey: ["dashboard-all-branch-monthly", selectedYear],
    queryFn: async () => {
      // Fetch Highticket data for all branches
      const PAGE_SIZE = 1000;
      let allHighticket: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("highticket_data")
          .select("tanggal_transaksi, harga, asal_iklan")
          .gte("tanggal_transaksi", yearStartDate)
          .lte("tanggal_transaksi", yearEndDate)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allHighticket = [...allHighticket, ...data];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Fetch SH2M Revenue data for all branches
      let allSH2M: any[] = [];
      from = 0;
      hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("sh2m_revenue")
          .select("tahun, bulan, omset, asal_iklan")
          .eq("tahun", selectedYear)
          .range(from, from + PAGE_SIZE - 1);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
          allSH2M = [...allSH2M, ...data];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }

      // Group Highticket by month and branch
      const monthlyData: Record<number, { bekasi: number; jogja: number; sh2mBekasi: number; sh2mJogja: number }> = {};
      for (let i = 0; i < 12; i++) {
        monthlyData[i] = { bekasi: 0, jogja: 0, sh2mBekasi: 0, sh2mJogja: 0 };
      }

      allHighticket.forEach(tx => {
        if (tx.tanggal_transaksi) {
          const month = parseISO(tx.tanggal_transaksi).getMonth();
          const isBekasi = tx.asal_iklan?.toLowerCase().includes('bekasi');
          if (isBekasi) {
            monthlyData[month].bekasi += tx.harga || 0;
          } else {
            monthlyData[month].jogja += tx.harga || 0;
          }
        }
      });

      // Group SH2M by month and branch
      allSH2M.forEach(tx => {
        const month = (tx.bulan || 1) - 1; // bulan uses 1-12
        const isBekasi = tx.asal_iklan?.toLowerCase().includes('bekasi');
        if (isBekasi) {
          monthlyData[month].sh2mBekasi += tx.omset || 0;
        } else {
          monthlyData[month].sh2mJogja += tx.omset || 0;
        }
      });

      return months.map(m => ({
        bulan: m.label,
        htBekasi: monthlyData[m.value].bekasi,
        htJogja: monthlyData[m.value].jogja,
        sh2mBekasi: monthlyData[m.value].sh2mBekasi,
        sh2mJogja: monthlyData[m.value].sh2mJogja,
        totalBekasi: monthlyData[m.value].bekasi + monthlyData[m.value].sh2mBekasi,
        totalJogja: monthlyData[m.value].jogja + monthlyData[m.value].sh2mJogja,
        grandTotal: monthlyData[m.value].bekasi + monthlyData[m.value].jogja + monthlyData[m.value].sh2mBekasi + monthlyData[m.value].sh2mJogja,
      }));
    },
  });

  // Get SH2M YoY data (current year vs previous year)
  const { data: sh2mYoyData } = useQuery({
    queryKey: ["dashboard-sh2m-yoy", branchFilter, selectedYear],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      
      // Fetch current year SH2M
      let currentYearSH2M: any[] = [];
      let from = 0;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from("sh2m_revenue")
          .select("omset")
          .eq("tahun", selectedYear)
          .range(from, from + PAGE_SIZE - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          currentYearSH2M = [...currentYearSH2M, ...data];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      // Fetch previous year SH2M
      let prevYearSH2M: any[] = [];
      from = 0;
      hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from("sh2m_revenue")
          .select("omset")
          .eq("tahun", previousYear)
          .range(from, from + PAGE_SIZE - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          prevYearSH2M = [...prevYearSH2M, ...data];
          from += PAGE_SIZE;
          hasMore = data.length === PAGE_SIZE;
        } else {
          hasMore = false;
        }
      }
      
      const currentYearTotal = currentYearSH2M.reduce((sum, d) => sum + (d.omset || 0), 0);
      const prevYearTotal = prevYearSH2M.reduce((sum, d) => sum + (d.omset || 0), 0);
      
      return { currentYearTotal, prevYearTotal };
    },
  });

  // Calculate YoY summary metrics for Highticket
  const yoyHighticketMetrics = yoyComparisonData?.reduce((acc, month) => {
    acc.currentYearTotal += month[selectedYear] || 0;
    acc.prevYearTotal += month[previousYear] || 0;
    return acc;
  }, { currentYearTotal: 0, prevYearTotal: 0 });

  const yoyHighticketGrowth = yoyHighticketMetrics?.prevYearTotal > 0
    ? ((yoyHighticketMetrics.currentYearTotal - yoyHighticketMetrics.prevYearTotal) / yoyHighticketMetrics.prevYearTotal * 100)
    : 0;

  // Calculate YoY summary metrics for SH2M
  const yoySH2MGrowth = sh2mYoyData?.prevYearTotal > 0
    ? ((sh2mYoyData.currentYearTotal - sh2mYoyData.prevYearTotal) / sh2mYoyData.prevYearTotal * 100)
    : 0;

  // Calculate YoY combined (Highticket + SH2M)
  const yoyCombinedCurrentYear = (yoyHighticketMetrics?.currentYearTotal || 0) + (sh2mYoyData?.currentYearTotal || 0);
  const yoyCombinedPrevYear = (yoyHighticketMetrics?.prevYearTotal || 0) + (sh2mYoyData?.prevYearTotal || 0);
  const yoyCombinedGrowth = yoyCombinedPrevYear > 0
    ? ((yoyCombinedCurrentYear - yoyCombinedPrevYear) / yoyCombinedPrevYear * 100)
    : 0;

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) {
      return `${(value / 1000000000).toFixed(1)}M`;
    } else if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}Jt`;
    } else if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}rb`;
    }
    return value.toString();
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name === 'revenue' ? 'Revenue' : entry.name}: {
                typeof entry.value === 'number' 
                  ? `Rp ${entry.value.toLocaleString('id-ID')}` 
                  : entry.value
              }
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const getGrowthIndicator = (growth: number) => {
    if (growth > 1) {
      return <ArrowUpRight className="h-4 w-4 text-emerald-500" />;
    } else if (growth < -1) {
      return <ArrowDownRight className="h-4 w-4 text-red-500" />;
    }
    return <Minus className="h-4 w-4 text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{selectedBranch}</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
            <SelectTrigger className="w-[140px] bg-popover">
              <SelectValue placeholder="Pilih bulan" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {months.map((month) => (
                <SelectItem key={month.value} value={month.value.toString()}>
                  {month.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
            <SelectTrigger className="w-[100px] bg-popover">
              <SelectValue placeholder="Tahun" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {years.map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue (All Time)
            </CardTitle>
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {(totalRevenue || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Highticket + SH2M ({selectedBranch})</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue {months[selectedMonth].label}
            </CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Calendar className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {(currentMonthRevenue || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Bulan ini</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tagihan DP/Angsuran
            </CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10">
              <CreditCard className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {(dpMetrics?.totalHargaBayar || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">{dpMetrics?.count || 0} client DP/Angsuran</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Harga Asli (DP/Angsuran)
            </CardTitle>
            <div className="p-2 rounded-lg bg-purple-500/10">
              <Receipt className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rp {(dpMetrics?.totalHarga || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Nilai program asli</p>
          </CardContent>
        </Card>
      </div>

      {/* SH2M Revenue Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="border-teal-500/30 bg-gradient-to-br from-teal-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue SH2M (All Time)
            </CardTitle>
            <div className="p-2 rounded-lg bg-teal-500/10">
              <TrendingUp className="h-4 w-4 text-teal-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-teal-600">Rp {(sh2mRevenueData?.totalOmset || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Total omset tim SH2M</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue SH2M {months[selectedMonth].label}
            </CardTitle>
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Calendar className="h-4 w-4 text-cyan-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-cyan-600">Rp {(sh2mMonthlyRevenue?.total || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">{sh2mMonthlyRevenue?.count || 0} data CS</p>
          </CardContent>
        </Card>
        <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-500/5 to-transparent">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Revenue Highticket (All Time)
            </CardTitle>
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <DollarSign className="h-4 w-4 text-indigo-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">Rp {(highticketRevenue || 0).toLocaleString('id-ID')}</div>
            <p className="text-xs text-muted-foreground mt-1">Total program highticket</p>
          </CardContent>
        </Card>
      </div>

      {/* YoY Growth Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* YoY Highticket */}
        <Card className="bg-gradient-to-r from-indigo-500/5 to-indigo-500/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              YoY Highticket ({previousYear} → {selectedYear})
            </CardTitle>
            <div className="flex items-center gap-2">
              {getGrowthIndicator(yoyHighticketGrowth)}
              <span className={`text-lg font-bold ${yoyHighticketGrowth > 0 ? 'text-emerald-500' : yoyHighticketGrowth < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                {yoyHighticketGrowth > 0 ? '+' : ''}{yoyHighticketGrowth.toFixed(1)}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Revenue {previousYear}</p>
                <p className="text-lg font-semibold">Rp {(yoyHighticketMetrics?.prevYearTotal || 0).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue {selectedYear}</p>
                <p className="text-lg font-semibold">Rp {(yoyHighticketMetrics?.currentYearTotal || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* YoY SH2M */}
        <Card className="bg-gradient-to-r from-teal-500/5 to-teal-500/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              YoY SH2M ({previousYear} → {selectedYear})
            </CardTitle>
            <div className="flex items-center gap-2">
              {getGrowthIndicator(yoySH2MGrowth)}
              <span className={`text-lg font-bold ${yoySH2MGrowth > 0 ? 'text-emerald-500' : yoySH2MGrowth < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                {yoySH2MGrowth > 0 ? '+' : ''}{yoySH2MGrowth.toFixed(1)}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Revenue {previousYear}</p>
                <p className="text-lg font-semibold">Rp {(sh2mYoyData?.prevYearTotal || 0).toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue {selectedYear}</p>
                <p className="text-lg font-semibold">Rp {(sh2mYoyData?.currentYearTotal || 0).toLocaleString('id-ID')}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* YoY Gabungan */}
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              YoY Gabungan ({previousYear} → {selectedYear})
            </CardTitle>
            <div className="flex items-center gap-2">
              {getGrowthIndicator(yoyCombinedGrowth)}
              <span className={`text-lg font-bold ${yoyCombinedGrowth > 0 ? 'text-emerald-500' : yoyCombinedGrowth < 0 ? 'text-red-500' : 'text-yellow-500'}`}>
                {yoyCombinedGrowth > 0 ? '+' : ''}{yoyCombinedGrowth.toFixed(1)}%
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Revenue {previousYear}</p>
                <p className="text-lg font-semibold">Rp {yoyCombinedPrevYear.toLocaleString('id-ID')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue {selectedYear}</p>
                <p className="text-lg font-semibold">Rp {yoyCombinedCurrentYear.toLocaleString('id-ID')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Revenue Table - Based on Selected Branch */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Data Revenue Bulanan {selectedYear} - {selectedBranch}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Bulan</TableHead>
                  {(!branchFilter || branchFilter.toLowerCase().includes('bekasi')) && (
                    <>
                      <TableHead className="text-right font-semibold">{branchFilter ? 'Highticket' : 'HT Bekasi'}</TableHead>
                      <TableHead className="text-right font-semibold">{branchFilter ? 'SH2M' : 'SH2M Bekasi'}</TableHead>
                      <TableHead className="text-right font-semibold bg-blue-500/10">{branchFilter ? 'Total' : 'Total Bekasi'}</TableHead>
                    </>
                  )}
                  {(!branchFilter || branchFilter.toLowerCase().includes('jogja')) && (
                    <>
                      <TableHead className="text-right font-semibold">{branchFilter ? 'Highticket' : 'HT Jogja'}</TableHead>
                      <TableHead className="text-right font-semibold">{branchFilter ? 'SH2M' : 'SH2M Jogja'}</TableHead>
                      <TableHead className="text-right font-semibold bg-green-500/10">{branchFilter ? 'Total' : 'Total Jogja'}</TableHead>
                    </>
                  )}
                  {!branchFilter && (
                    <TableHead className="text-right font-semibold bg-primary/10">Grand Total</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {allBranchMonthlyData?.map((row, index) => (
                  <TableRow key={index} className={index === selectedMonth ? "bg-primary/5" : ""}>
                    <TableCell className="font-medium">{row.bulan}</TableCell>
                    {(!branchFilter || branchFilter.toLowerCase().includes('bekasi')) && (
                      <>
                        <TableCell className="text-right">Rp {row.htBekasi.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right">Rp {row.sh2mBekasi.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-semibold bg-blue-500/5">Rp {row.totalBekasi.toLocaleString('id-ID')}</TableCell>
                      </>
                    )}
                    {(!branchFilter || branchFilter.toLowerCase().includes('jogja')) && (
                      <>
                        <TableCell className="text-right">Rp {row.htJogja.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right">Rp {row.sh2mJogja.toLocaleString('id-ID')}</TableCell>
                        <TableCell className="text-right font-semibold bg-green-500/5">Rp {row.totalJogja.toLocaleString('id-ID')}</TableCell>
                      </>
                    )}
                    {!branchFilter && (
                      <TableCell className="text-right font-bold bg-primary/5">Rp {row.grandTotal.toLocaleString('id-ID')}</TableCell>
                    )}
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="border-t-2 font-bold bg-muted/50">
                  <TableCell>TOTAL</TableCell>
                  {(!branchFilter || branchFilter.toLowerCase().includes('bekasi')) && (
                    <>
                      <TableCell className="text-right">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.htBekasi, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.sh2mBekasi, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right bg-blue-500/10">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.totalBekasi, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                    </>
                  )}
                  {(!branchFilter || branchFilter.toLowerCase().includes('jogja')) && (
                    <>
                      <TableCell className="text-right">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.htJogja, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.sh2mJogja, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                      <TableCell className="text-right bg-green-500/10">
                        Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.totalJogja, 0) || 0).toLocaleString('id-ID')}
                      </TableCell>
                    </>
                  )}
                  {!branchFilter && (
                    <TableCell className="text-right bg-primary/10">
                      Rp {(allBranchMonthlyData?.reduce((sum, r) => sum + r.grandTotal, 0) || 0).toLocaleString('id-ID')}
                    </TableCell>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {sh2mMonthlyRevenue && Object.keys(sh2mMonthlyRevenue.byCs).length > 0 && (
        <Card className="border-teal-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-teal-600">
              <BarChart3 className="h-5 w-5" />
              Revenue SH2M per CS - {months[selectedMonth].label} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={Object.entries(sh2mMonthlyRevenue.byCs)
                    .map(([name, revenue]) => ({ name, revenue }))
                    .sort((a, b) => b.revenue - a.revenue)} 
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={100} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(172, 66%, 50%)" 
                    radius={[0, 4, 4, 0]}
                    name="revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Revenue Highticket {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            const maxRevenue = monthlyRevenueData ? Math.max(...monthlyRevenueData.map(d => d.revenue)) : 0;
            const minRevenue = monthlyRevenueData ? Math.min(...monthlyRevenueData.filter(d => d.revenue > 0).map(d => d.revenue)) : 0;
            const maxMonth = monthlyRevenueData?.find(d => d.revenue === maxRevenue);
            const minMonth = monthlyRevenueData?.find(d => d.revenue === minRevenue && d.revenue > 0);
            
            return (
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenueData} margin={{ top: 30, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis tickFormatter={formatCurrency} className="text-xs" />
                    <Tooltip content={<CustomTooltip />} />
                    {maxMonth && (
                      <ReferenceDot 
                        x={maxMonth.name} 
                        y={maxRevenue} 
                        r={8} 
                        fill="hsl(142, 76%, 36%)" 
                        stroke="white" 
                        strokeWidth={2}
                      />
                    )}
                    {minMonth && minRevenue > 0 && (
                      <ReferenceDot 
                        x={minMonth.name} 
                        y={minRevenue} 
                        r={8} 
                        fill="hsl(0, 84%, 60%)" 
                        stroke="white" 
                        strokeWidth={2}
                      />
                    )}
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      fill="hsl(var(--primary))" 
                      fillOpacity={0.3}
                      strokeWidth={2}
                      name="revenue"
                    >
                      <LabelList 
                        dataKey="revenue" 
                        position="top" 
                        formatter={(value: number) => value > 0 ? `${(value / 1000000).toFixed(0)}jt` : ''} 
                        className="text-xs fill-foreground"
                        offset={10}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-6 mt-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Max: {maxMonth?.name} (Rp {maxRevenue.toLocaleString('id-ID')})</span>
                  </div>
                  {minMonth && minRevenue > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span>Min: {minMonth?.name} (Rp {minRevenue.toLocaleString('id-ID')})</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* YoY Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            YoY Comparison - {selectedYear} vs {previousYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={yoyComparisonData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey={selectedYear}
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name={`${selectedYear}`}
                />
                <Line 
                  type="monotone" 
                  dataKey={previousYear}
                  stroke="hsl(var(--chart-3))" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                  name={`${previousYear}`}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Weekly and Daily Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Weekly Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Weekly Revenue - {months[selectedMonth].label} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--chart-2))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6 }}
                    name="revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Daily Revenue Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Daily Revenue - {months[selectedMonth].label} {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--chart-3))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--chart-3))", strokeWidth: 2, r: 3 }}
                    activeDot={{ r: 5 }}
                    name="revenue"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend by EC Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Revenue per EC - {months[selectedMonth].label} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {salesTrendData?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Belum ada data transaksi
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesTrendData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
                  <YAxis type="category" dataKey="name" className="text-xs" width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--chart-4))" 
                    radius={[0, 4, 4, 0]}
                    name="revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
