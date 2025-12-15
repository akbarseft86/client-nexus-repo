import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranch } from "@/contexts/BranchContext";
import { DollarSign, TrendingUp, BarChart3, Calendar } from "lucide-react";
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

  // Helper function to get client IDs for branch filter
  const getClientIds = async () => {
    if (!branchFilter) return null;
    
    const { data: sh2mClients } = await supabase
      .from("sh2m_data")
      .select("client_id")
      .eq("asal_iklan", branchFilter);
    
    return sh2mClients?.map(c => c.client_id) || [];
  };

  // Get Total Revenue (All Time for this branch)
  const { data: totalRevenue } = useQuery({
    queryKey: ["dashboard-total-revenue", branchFilter],
    queryFn: async () => {
      const clientIds = await getClientIds();
      
      if (branchFilter && clientIds && clientIds.length === 0) {
        return 0;
      }

      let query = supabase.from("highticket_data").select("harga");
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return data?.reduce((sum, d) => sum + (d.harga || 0), 0) || 0;
    },
  });

  // Get Monthly Revenue for the selected year (for monthly chart)
  const { data: monthlyRevenueData } = useQuery({
    queryKey: ["dashboard-monthly-revenue", branchFilter, selectedYear],
    queryFn: async () => {
      const clientIds = await getClientIds();
      
      if (branchFilter && clientIds && clientIds.length === 0) {
        return months.map(m => ({ name: m.label.substring(0, 3), revenue: 0, transactions: 0 }));
      }

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", yearStartDate)
        .lte("tanggal_transaksi", yearEndDate);
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
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
      const clientIds = await getClientIds();
      
      const weeks = eachWeekOfInterval(
        { start: startOfMonth(selectedDate), end: endOfMonth(selectedDate) },
        { weekStartsOn: 1 }
      );

      if (branchFilter && clientIds && clientIds.length === 0) {
        return weeks.map((_, i) => ({ name: `Minggu ${i + 1}`, revenue: 0, transactions: 0 }));
      }

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
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
      const clientIds = await getClientIds();
      
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });

      if (branchFilter && clientIds && clientIds.length === 0) {
        return days.map(day => ({ name: format(day, 'd'), revenue: 0 }));
      }

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi, harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
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

  // Get Sales Trend (transactions count per day for selected month)
  const { data: salesTrendData } = useQuery({
    queryKey: ["dashboard-sales-trend", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const clientIds = await getClientIds();
      
      const days = eachDayOfInterval({
        start: startOfMonth(selectedDate),
        end: endOfMonth(selectedDate),
      });

      if (branchFilter && clientIds && clientIds.length === 0) {
        return days.map(day => ({ name: format(day, 'd'), sales: 0 }));
      }

      let query = supabase
        .from("highticket_data")
        .select("tanggal_transaksi")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const salesCount = data?.filter(tx => tx.tanggal_transaksi === dayStr).length || 0;

        return {
          name: format(day, 'd'),
          sales: salesCount,
        };
      });
    },
  });

  // Get monthly revenue for selected month
  const { data: currentMonthRevenue } = useQuery({
    queryKey: ["dashboard-current-month-revenue", branchFilter, monthStartDate, monthEndDate],
    queryFn: async () => {
      const clientIds = await getClientIds();
      
      if (branchFilter && clientIds && clientIds.length === 0) {
        return 0;
      }

      let query = supabase
        .from("highticket_data")
        .select("harga")
        .gte("tanggal_transaksi", monthStartDate)
        .lte("tanggal_transaksi", monthEndDate);
      
      if (branchFilter && clientIds && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
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
      <div className="grid gap-4 md:grid-cols-2">
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
              Revenue {months[selectedMonth].label} {selectedYear}
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
              <BarChart data={monthlyRevenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="revenue" 
                  fill="hsl(var(--primary))" 
                  radius={[4, 4, 0, 0]}
                  name="revenue"
                />
              </BarChart>
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
                <BarChart data={weeklyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--chart-2))" 
                    radius={[4, 4, 0, 0]}
                    name="revenue"
                  />
                </BarChart>
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
                <AreaChart data={dailyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="name" className="text-xs" interval="preserveStartEnd" />
                  <YAxis tickFormatter={formatCurrency} className="text-xs" />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="hsl(var(--chart-3))" 
                    fill="hsl(var(--chart-3))" 
                    fillOpacity={0.3}
                    name="revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Sales Trend - {months[selectedMonth].label} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={salesTrendData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" interval="preserveStartEnd" />
                <YAxis className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="hsl(var(--chart-4))" 
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--chart-4))", strokeWidth: 2, r: 3 }}
                  activeDot={{ r: 5 }}
                  name="sales"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
