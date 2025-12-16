import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, AlertTriangle, CheckCircle, XCircle, Users, Phone, FileWarning, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { id } from "date-fns/locale";

// Normalize phone number to 628xxxxxxxxx format
function normalizePhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Convert scientific notation if present
  let normalized = String(phone);
  if (normalized.includes("E") || normalized.includes("e")) {
    const num = parseFloat(normalized);
    if (!isNaN(num)) {
      normalized = num.toFixed(0);
    }
  }
  
  // Remove all non-numeric characters
  normalized = normalized.replace(/\D/g, "");
  
  // Convert to 628 format
  if (normalized.startsWith("0")) {
    normalized = "62" + normalized.substring(1);
  } else if (normalized.startsWith("8")) {
    normalized = "62" + normalized;
  } else if (!normalized.startsWith("62")) {
    normalized = "62" + normalized;
  }
  
  return normalized;
}

// Validate phone number format
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Valid Indonesian phone: 62 + 8-13 digits
  return /^62\d{8,13}$/.test(normalized);
}

interface DataQualityIssue {
  id: string;
  client_id: string;
  nama_client: string;
  nohp_client: string;
  source_iklan: string;
  status_payment: string;
  tanggal: string;
  asal_iklan: string;
  issues: string[];
}

export default function DataTrust() {
  // Fetch all SH2M data with pagination
  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["data-trust-sh2m"],
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

  // Fetch source iklan categories with pagination
  const { data: categories } = useQuery({
    queryKey: ["data-trust-categories"],
    queryFn: async () => {
      const PAGE_SIZE = 1000;
      let allData: any[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from("source_iklan_categories")
          .select("*")
          .range(from, from + PAGE_SIZE - 1);

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

  // Calculate data quality metrics
  const calculateMetrics = () => {
    if (!sh2mData) return null;

    const today = new Date();
    const categorizedSources = new Set(categories?.filter(c => c.kategori)?.map(c => c.source_iklan) || []);

    // Group by normalized phone
    const phoneGroups = new Map<string, typeof sh2mData>();
    sh2mData.forEach(record => {
      const normalizedPhone = normalizePhoneNumber(record.nohp_client);
      if (!phoneGroups.has(normalizedPhone)) {
        phoneGroups.set(normalizedPhone, []);
      }
      phoneGroups.get(normalizedPhone)!.push(record);
    });

    // Count duplicates (phone numbers appearing more than once)
    let duplicateCount = 0;
    let duplicateRecords = 0;
    phoneGroups.forEach((records) => {
      if (records.length > 1) {
        duplicateCount++;
        duplicateRecords += records.length;
      }
    });

    // Data quality issues
    const issues: DataQualityIssue[] = [];
    let emptyPhone = 0;
    let invalidPhone = 0;
    let emptySourceIklan = 0;
    let emptyStatus = 0;
    let unpaidOver7Days = 0;
    let uncategorizedSource = 0;

    sh2mData.forEach(record => {
      const recordIssues: string[] = [];

      // Check phone number
      if (!record.nohp_client || record.nohp_client.trim() === "") {
        emptyPhone++;
        recordIssues.push("No HP kosong");
      } else if (!isValidPhoneNumber(record.nohp_client)) {
        invalidPhone++;
        recordIssues.push("No HP tidak valid");
      }

      // Check source iklan
      if (!record.source_iklan || record.source_iklan.trim() === "") {
        emptySourceIklan++;
        recordIssues.push("Source iklan kosong");
      } else if (!categorizedSources.has(record.source_iklan)) {
        uncategorizedSource++;
        recordIssues.push("Source iklan belum dikategorikan");
      }

      // Check status payment
      if (!record.status_payment || record.status_payment.trim() === "") {
        emptyStatus++;
        recordIssues.push("Status payment kosong");
      }

      // Check unpaid > 7 days
      if (record.status_payment === "unpaid" && record.tanggal) {
        const recordDate = new Date(record.tanggal);
        const daysDiff = differenceInDays(today, recordDate);
        if (daysDiff > 7) {
          unpaidOver7Days++;
          recordIssues.push(`Unpaid > 7 hari (${daysDiff} hari)`);
        }
      }

      if (recordIssues.length > 0) {
        issues.push({
          id: record.id,
          client_id: record.client_id,
          nama_client: record.nama_client,
          nohp_client: record.nohp_client,
          source_iklan: record.source_iklan,
          status_payment: record.status_payment || "",
          tanggal: record.tanggal,
          asal_iklan: record.asal_iklan || "",
          issues: recordIssues,
        });
      }
    });

    const totalData = sh2mData.length;
    const cleanData = totalData - issues.length;
    const cleanPercentage = totalData > 0 ? (cleanData / totalData) * 100 : 100;

    return {
      totalData,
      cleanData,
      cleanPercentage,
      duplicateCount,
      duplicateRecords,
      emptyPhone,
      invalidPhone,
      emptySourceIklan,
      emptyStatus,
      unpaidOver7Days,
      uncategorizedSource,
      issues,
      bekasiCount: sh2mData.filter(d => d.asal_iklan === "SEFT Corp - Bekasi").length,
      jogjaCount: sh2mData.filter(d => d.asal_iklan === "SEFT Corp - Jogja").length,
    };
  };

  const metrics = calculateMetrics();

  const getTrustBadge = (percentage: number) => {
    if (percentage >= 90) {
      return <Badge className="bg-green-500 hover:bg-green-600 text-white"><CheckCircle className="h-3 w-3 mr-1" />Data Bersih</Badge>;
    } else if (percentage >= 70) {
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white"><AlertTriangle className="h-3 w-3 mr-1" />Perlu Review</Badge>;
    } else {
      return <Badge className="bg-red-500 hover:bg-red-600 text-white"><XCircle className="h-3 w-3 mr-1" />Bermasalah</Badge>;
    }
  };

  const getIssueBadge = (issue: string) => {
    if (issue.includes("kosong") || issue.includes("tidak valid")) {
      return <Badge variant="destructive" className="text-xs">{issue}</Badge>;
    } else if (issue.includes("Unpaid")) {
      return <Badge className="bg-yellow-500 text-white text-xs">{issue}</Badge>;
    } else {
      return <Badge variant="secondary" className="text-xs">{issue}</Badge>;
    }
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
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Data Trust</h1>
          <p className="text-muted-foreground">Monitoring kualitas dan konsistensi data - Semua Cabang</p>
        </div>
      </div>

      {/* Trust Score Overview */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Trust Score</CardTitle>
            {metrics && getTrustBadge(metrics.cleanPercentage)}
          </div>
          <CardDescription>Indikator kepercayaan data keseluruhan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="text-5xl font-bold text-primary">
              {metrics?.cleanPercentage.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">
              <p>{metrics?.cleanData.toLocaleString()} dari {metrics?.totalData.toLocaleString()} data bersih</p>
              <p>{metrics?.issues.length.toLocaleString()} data bermasalah</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="mt-4 h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                (metrics?.cleanPercentage || 0) >= 90 ? "bg-green-500" :
                (metrics?.cleanPercentage || 0) >= 70 ? "bg-yellow-500" : "bg-red-500"
              }`}
              style={{ width: `${metrics?.cleanPercentage || 0}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Total Data</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.totalData.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Bekasi: {metrics?.bekasiCount.toLocaleString()} | Jogja: {metrics?.jogjaCount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Duplikat</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.duplicateCount.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{metrics?.duplicateRecords.toLocaleString()} record</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-red-500" />
              <span className="text-sm text-muted-foreground">HP Bermasalah</span>
            </div>
            <p className="text-2xl font-bold mt-2">{((metrics?.emptyPhone || 0) + (metrics?.invalidPhone || 0)).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Kosong: {metrics?.emptyPhone} | Invalid: {metrics?.invalidPhone}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileWarning className="h-5 w-5 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Source Iklan</span>
            </div>
            <p className="text-2xl font-bold mt-2">{((metrics?.emptySourceIklan || 0) + (metrics?.uncategorizedSource || 0)).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              Kosong: {metrics?.emptySourceIklan} | Tanpa kategori: {metrics?.uncategorizedSource}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-gray-500" />
              <span className="text-sm text-muted-foreground">Status Kosong</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.emptyStatus.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Perlu diisi</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <span className="text-sm text-muted-foreground">Unpaid &gt; 7 Hari</span>
            </div>
            <p className="text-2xl font-bold mt-2">{metrics?.unpaidOver7Days.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Perlu follow up</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            Data Bermasalah ({metrics?.issues.length.toLocaleString()})
          </CardTitle>
          <CardDescription>Daftar data yang memerlukan perhatian atau perbaikan</CardDescription>
        </CardHeader>
        <CardContent>
          {metrics?.issues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Semua data dalam kondisi baik!</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Client ID</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>No HP</TableHead>
                    <TableHead>Source Iklan</TableHead>
                    <TableHead>Cabang</TableHead>
                    <TableHead>Masalah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics?.issues.slice(0, 100).map((issue) => (
                    <TableRow key={issue.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(issue.tanggal), "dd MMM yyyy", { locale: id })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{issue.client_id}</TableCell>
                      <TableCell>{issue.nama_client}</TableCell>
                      <TableCell className="font-mono">{issue.nohp_client}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{issue.source_iklan}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {issue.asal_iklan?.includes("Bekasi") ? "Bekasi" : "Jogja"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {issue.issues.map((isu, idx) => (
                            <span key={idx}>{getIssueBadge(isu)}</span>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(metrics?.issues.length || 0) > 100 && (
                <p className="text-center text-sm text-muted-foreground mt-4">
                  Menampilkan 100 dari {metrics?.issues.length.toLocaleString()} data bermasalah
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
