import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBranch } from "@/contexts/BranchContext";
import { Users, FileText, CreditCard, TrendingUp, DollarSign, UserCheck } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { id } from "date-fns/locale";

export default function Dashboard() {
  const { getBranchFilter, selectedBranch } = useBranch();
  const branchFilter = getBranchFilter();

  // Get SH2M data count
  const { data: sh2mData } = useQuery({
    queryKey: ["dashboard-sh2m", branchFilter],
    queryFn: async () => {
      let query = supabase.from("sh2m_data").select("*", { count: "exact" });
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      const { data, count, error } = await query;
      if (error) throw error;
      
      const paidCount = data?.filter(d => d.status_payment === 'paid').length || 0;
      return { total: count || 0, paid: paidCount, data };
    },
  });

  // Get Highticket data
  const { data: highticketData } = useQuery({
    queryKey: ["dashboard-highticket", branchFilter],
    queryFn: async () => {
      // First get client_ids from sh2m_data filtered by branch
      let clientQuery = supabase.from("sh2m_data").select("client_id");
      if (branchFilter) {
        clientQuery = clientQuery.eq("asal_iklan", branchFilter);
      }
      const { data: sh2mClients, error: sh2mError } = await clientQuery;
      if (sh2mError) throw sh2mError;
      
      const clientIds = sh2mClients?.map(c => c.client_id) || [];
      
      if (branchFilter && clientIds.length === 0) {
        return { total: 0, totalRevenue: 0, lunas: 0, data: [] };
      }

      let query = supabase.from("highticket_data").select("*");
      if (branchFilter && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      const totalRevenue = data?.reduce((sum, d) => sum + (d.harga || 0), 0) || 0;
      const lunasCount = data?.filter(d => d.status_payment === 'Lunas').length || 0;
      
      return { total: data?.length || 0, totalRevenue, lunas: lunasCount, data };
    },
  });

  // Get this month's stats
  const { data: monthlyStats } = useQuery({
    queryKey: ["dashboard-monthly", branchFilter],
    queryFn: async () => {
      const now = new Date();
      const startOfThisMonth = format(startOfMonth(now), 'yyyy-MM-dd');
      const endOfThisMonth = format(endOfMonth(now), 'yyyy-MM-dd');
      const startOfLastMonth = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');
      const endOfLastMonth = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd');

      // This month SH2M
      let thisMonthQuery = supabase
        .from("sh2m_data")
        .select("*", { count: "exact" })
        .gte("tanggal", startOfThisMonth)
        .lte("tanggal", endOfThisMonth);
      
      if (branchFilter) {
        thisMonthQuery = thisMonthQuery.eq("asal_iklan", branchFilter);
      }
      
      const { count: thisMonthCount } = await thisMonthQuery;

      // Last month SH2M
      let lastMonthQuery = supabase
        .from("sh2m_data")
        .select("*", { count: "exact" })
        .gte("tanggal", startOfLastMonth)
        .lte("tanggal", endOfLastMonth);
      
      if (branchFilter) {
        lastMonthQuery = lastMonthQuery.eq("asal_iklan", branchFilter);
      }
      
      const { count: lastMonthCount } = await lastMonthQuery;

      return {
        thisMonth: thisMonthCount || 0,
        lastMonth: lastMonthCount || 0,
        growth: lastMonthCount ? (((thisMonthCount || 0) - lastMonthCount) / lastMonthCount * 100).toFixed(1) : 0
      };
    },
  });

  const stats = [
    {
      title: "Total Client SH2M",
      value: sh2mData?.total || 0,
      icon: Users,
      description: `${sh2mData?.paid || 0} client paid`,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Total Transaksi Highticket",
      value: highticketData?.total || 0,
      icon: FileText,
      description: `${highticketData?.lunas || 0} transaksi lunas`,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      title: "Total Revenue",
      value: `Rp ${(highticketData?.totalRevenue || 0).toLocaleString('id-ID')}`,
      icon: DollarSign,
      description: "Dari semua transaksi",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Client Bulan Ini",
      value: monthlyStats?.thisMonth || 0,
      icon: TrendingUp,
      description: `${Number(monthlyStats?.growth) > 0 ? '+' : ''}${monthlyStats?.growth}% dari bulan lalu`,
      color: Number(monthlyStats?.growth) >= 0 ? "text-green-500" : "text-red-500",
      bgColor: Number(monthlyStats?.growth) >= 0 ? "bg-green-500/10" : "bg-red-500/10",
    },
  ];

  // Get EC performance
  const { data: ecPerformance } = useQuery({
    queryKey: ["dashboard-ec-performance", branchFilter],
    queryFn: async () => {
      let query = supabase.from("sh2m_data").select("nama_ec, status_payment");
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      const { data, error } = await query;
      if (error) throw error;

      const ecStats: Record<string, { total: number; paid: number }> = {};
      data?.forEach(d => {
        const ec = d.nama_ec || 'Tidak ada EC';
        if (!ecStats[ec]) {
          ecStats[ec] = { total: 0, paid: 0 };
        }
        ecStats[ec].total++;
        if (d.status_payment === 'paid') {
          ecStats[ec].paid++;
        }
      });

      return Object.entries(ecStats)
        .map(([name, stats]) => ({
          name,
          total: stats.total,
          paid: stats.paid,
          rate: stats.total > 0 ? ((stats.paid / stats.total) * 100).toFixed(1) : 0
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
    },
  });

  // Get recent highticket transactions
  const { data: recentTransactions } = useQuery({
    queryKey: ["dashboard-recent-transactions", branchFilter],
    queryFn: async () => {
      let clientQuery = supabase.from("sh2m_data").select("client_id");
      if (branchFilter) {
        clientQuery = clientQuery.eq("asal_iklan", branchFilter);
      }
      const { data: sh2mClients } = await clientQuery;
      const clientIds = sh2mClients?.map(c => c.client_id) || [];

      let query = supabase
        .from("highticket_data")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (branchFilter && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{selectedBranch} - {format(new Date(), "MMMM yyyy", { locale: id })}</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* EC Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Performa EC (Top 5)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ecPerformance?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada data</p>
              ) : (
                ecPerformance?.map((ec, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{ec.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {ec.paid} paid dari {ec.total} client
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        Number(ec.rate) >= 50 ? 'text-green-500' : 'text-yellow-500'
                      }`}>
                        {ec.rate}%
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Transaksi Terbaru
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Belum ada transaksi</p>
              ) : (
                recentTransactions?.map((tx, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{tx.nama}</p>
                      <p className="text-sm text-muted-foreground">{tx.nama_program}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">Rp {tx.harga.toLocaleString('id-ID')}</p>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        tx.status_payment === 'Lunas' 
                          ? 'bg-green-500/10 text-green-500' 
                          : 'bg-yellow-500/10 text-yellow-500'
                      }`}>
                        {tx.status_payment}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
