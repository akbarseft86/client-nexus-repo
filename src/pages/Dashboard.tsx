import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranch } from "@/contexts/BranchContext";
import { DollarSign, TrendingUp, BarChart3, Calendar, CreditCard, Receipt } from "lucide-react";
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
} from "recharts";

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

  // Get Total Revenue (All Time for this branch) - fetch all records with pagination
  const { data: totalRevenue } = useQuery({
    queryKey: ["dashboard-total-revenue", branchFilter],
    queryFn: async () => {
      let allData: { harga: number }[] = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        let query = supabase
          .from("highticket_data")
          .select("harga")
          .range(page * pageSize, (page + 1) * pageSize - 1);
        
        if (branchFilter) {
          query = query.eq("asal_iklan", branchFilter);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data.length > 0) {
          allData = [...allData, ...data];
          hasMore = data.length === pageSize;
          page++;
        } else {
          hasMore = false;
        }
      }
      
      return allData.reduce((sum, d) => sum + (d.harga || 0), 0);
    },
  });

  // Get Total Harga Bayar (DP/Angsuran transactions) - what should be paid
  const { data: dpMetrics } = useQuery({
    queryKey: ["dashboard-dp-metrics", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      let query = supabase
        .from("highticket_data")
        .select("harga, harga_bayar, status_payment")
        .in("status_payment", ["DP", "Angsuran"])
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const totalHargaBayar = data?.reduce((sum, d) => sum + (d.harga_bayar || 0), 0) || 0;
      const totalHarga = data?.reduce((sum, d) => sum + (d.harga || 0), 0) || 0;
      const count = data?.length || 0;
      
      return { totalHargaBayar, totalHarga, count };
    },
  });

  // Get Monthly Revenue for the selected year (for monthly chart)
  const { data: monthlyRevenueData } = useQuery({
    queryKey: ["dashboard-monthly-revenue", branchFilter, selectedYear],
    queryFn: async () => {
      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", yearStartDate)
        .lte("tanggal_transaksi", yearEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Group by month
      const monthlyData: Record<number, { revenue: number; transactions: number }> = {};
      for (let i = 0; i < 12; i++) {
        monthlyData[i] = { revenue: 0, transactions: 0 };
      }

      data?.forEach(tx => {
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

  // Get Weekly Revenue for the selected month (for weekly chart)
  const { data: weeklyRevenueData } = useQuery({
    queryKey: ["dashboard-weekly-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const weeks = eachWeekOfInterval(
        { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) },
        { weekStartsOn: 1 }
      );

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      return weeks.map((weekStart, i) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const weekRevenue = data?.filter(tx => {
          const txDate = parseISO(tx.tanggal_transaksi);
          return txDate >= weekStart && txDate <= weekEnd;
        }).reduce((sum, tx) => sum + (tx.harga || 0), 0) || 0;
        
        const weekTransactions = data?.filter(tx => {
          const txDate = parseISO(tx.tanggal_transaksi);
          return txDate >= weekStart && txDate <= weekEnd;
        }).length || 0;

        return {
          name: `Minggu ${i + 1}`,
          revenue: weekRevenue,
          transactions: weekTransactions,
        };
      });
    },
  });

  // Get Daily Revenue for the selected month (for daily chart)
  const { data: dailyRevenueData } = useQuery({
    queryKey: ["dashboard-daily-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const dayRevenue = data?.filter(tx => tx.tanggal_transaksi === dayStr)
          .reduce((sum, tx) => sum + (tx.harga || 0), 0) || 0;

        return {
          name: format(day, 'd'),
          revenue: dayRevenue,
        };
      });
    },
  });

  // Get Sales Trend by EC (revenue per EC for selected month)
  const { data: salesTrendData } = useQuery({
    queryKey: ["dashboard-sales-trend", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      let query = supabase
        .from("highticket_data")
        .select("nama_ec, harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Group by EC name
      const ecRevenue: Record<string, number> = {};
      data?.forEach(tx => {
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

  // Get monthly revenue for selected month
  const { data: currentMonthRevenue } = useQuery({
    queryKey: ["dashboard-current-month-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      let query = supabase
        .from("highticket_data")
        .select("harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data?.reduce((sum, d) => sum + (d.harga || 0), 0) || 0;
    },
  });

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
              {entry.name === 'revenue' ? 'Revenue' : entry.name === 'sales' ? 'Transaksi' : entry.name}: {
                entry.name === 'revenue' 
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
            <p className="text-xs text-muted-foreground mt-1">Semua transaksi {selectedBranch}</p>
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

      {/* Monthly Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Monthly Revenue {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="hsl(var(--primary))" 
                  fill="hsl(var(--primary))" 
                  fillOpacity={0.3}
                  strokeWidth={2}
                  name="revenue"
                />
              </AreaChart>
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
