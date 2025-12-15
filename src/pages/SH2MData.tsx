import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Filter, Trash2, Download, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { useBranch } from "@/contexts/BranchContext";

// Parse date from various formats:
// ISO: "2025-11-12 01:30:05" or "2025-11-12 01:30"
// Indonesian: "12/11/25 01.30" or "12/11/2025 01:30"
const parseDateTimeFromCSV = (input: any) => {
  if (input == null) return { date: null as Date | null, time: '' };
  const str = String(input).trim();
  if (!str) return { date: null as Date | null, time: '' };

  // Try ISO format first: YYYY-MM-DD HH:MM:SS or YYYY-MM-DD HH:MM
  const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})(?::\d{2})?$/;
  const isoMatch = str.match(isoRegex);
  
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    const hour = parseInt(isoMatch[4], 10);
    const minute = parseInt(isoMatch[5], 10);
    
    const date = new Date(year, month - 1, day);
    const time = `${String(hour).padStart(2, '0')}.${String(minute).padStart(2, '0')}`;
    
    return { date, time };
  }

  // Try Indonesian format: DD/MM/YY(YY) HH.mm or HH:mm
  const indoRegex = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})(?:\s+(\d{1,2})[:.](\d{2}))?$/;
  const indoMatch = str.match(indoRegex);
  
  if (indoMatch) {
    const day = parseInt(indoMatch[1], 10);
    const month = parseInt(indoMatch[2], 10);
    let year = parseInt(indoMatch[3], 10);
    if (year < 100) year += 2000; // 25 -> 2025

    const date = new Date(year, month - 1, day);

    let time = '';
    if (indoMatch[4] != null && indoMatch[5] != null) {
      const hh = String(parseInt(indoMatch[4], 10)).padStart(2, '0');
      const mm = String(parseInt(indoMatch[5], 10)).padStart(2, '0');
      time = `${hh}.${mm}`;
    }

    return { date, time };
  }

  return { date: null as Date | null, time: '' };
};

// Generate client ID: DDMMYYYY-IIIII-S
const generateClientId = (tanggal: Date, nama: string, nohp: string, sourceIklan: string) => {
  const day = String(tanggal.getDate()).padStart(2, '0');
  const month = String(tanggal.getMonth() + 1).padStart(2, '0');
  const year = tanggal.getFullYear();
  
  // Get initials (first 2 letters of first name)
  const nameParts = nama.trim().split(' ');
  const initials = nameParts[0].substring(0, 2).toUpperCase();
  
  // Get last 4 digits of phone
  const phoneDigits = nohp.replace(/\D/g, '').slice(-4);
  
  // Get initial of source iklan
  const sourceInitial = sourceIklan.charAt(0).toUpperCase();
  
  return `${day}${month}${year}-${initials}${phoneDigits}-${sourceInitial}`;
};

// Helpers for date formatting without timezone shifts
const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatIdDate = (ymd: string) => {
  if (!ymd || typeof ymd !== 'string' || !ymd.includes('-')) return ymd as any;
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return ymd as any;
  return new Date(y, m - 1, d).toLocaleDateString('id-ID');
};

const EC_OPTIONS = ['Farah', 'Intan', 'Rizki', 'Sefhia', 'Yola'];

export default function SH2MData() {
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEC, setFilterEC] = useState("");
  const [filterAsalIklan, setFilterAsalIklan] = useState("");
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);
  
  const { getBranchFilter, selectedBranch } = useBranch();
  const branchFilter = getBranchFilter();
  const isPreviewMode = selectedBranch === "SEFT ALL";
  
  const queryClient = useQueryClient();

  const { data: sh2mData, isLoading } = useQuery({
    queryKey: ["sh2m-data", filterDate, filterStatus, filterEC, filterAsalIklan, branchFilter],
    queryFn: async () => {
      // Fetch SH2M data
      let query = supabase.from("sh2m_data").select("*")
        .order("tanggal", { ascending: false })
        .order("jam", { ascending: false });
      
      // Filter by branch (only when not in preview mode)
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      // Filter by asal_iklan (only in preview mode - SEFT ALL)
      if (!branchFilter && filterAsalIklan) {
        query = query.eq("asal_iklan", filterAsalIklan);
      }
      
      if (filterDate) {
        query = query.eq("tanggal", filterDate);
      }
      if (filterStatus) {
        query = query.eq("status_payment", filterStatus);
      }
      if (filterEC) {
        query = query.ilike("nama_ec", `%${filterEC}%`);
      }

      
      const { data: sh2mRows, error: sh2mError } = await query;
      if (sh2mError) throw sh2mError;
      
      // Fetch categories
      const { data: categories, error: catError } = await supabase
        .from("source_iklan_categories")
        .select("source_iklan, kategori");
      
      if (catError) throw catError;
      
      // Create a map of source_iklan to kategori
      const categoryMap = new Map(
        categories?.map(cat => [cat.source_iklan, cat.kategori]) || []
      );
      
      // Merge data
      return sh2mRows?.map(row => ({
        ...row,
        kategori: categoryMap.get(row.source_iklan) || '-'
      }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase
        .from("sh2m_data")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      toast.success("Data berhasil diupdate");
      setEditingRow(null);
    },
    onError: () => {
      toast.error("Gagal mengupdate data");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sh2m_data")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      toast.success("Data berhasil dihapus");
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error("Gagal menghapus data");
    },
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      // Delete all filtered data or all data if no filter
      let query = supabase.from("sh2m_data").delete();
      
      if (filterDate) {
        query = query.eq("tanggal", filterDate);
      }
      if (filterStatus) {
        query = query.eq("status_payment", filterStatus);
      }
      if (filterEC) {
        query = query.ilike("nama_ec", `%${filterEC}%`);
      }
      
      // If no filters, delete all
      if (!filterDate && !filterStatus && !filterEC) {
        query = query.neq("id", "00000000-0000-0000-0000-000000000000"); // Match all
      }
      
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      toast.success("Semua data berhasil dihapus");
      setDeleteAllConfirm(false);
    },
    onError: () => {
      toast.error("Gagal menghapus data");
    },
  });

  const normalizePhoneNumber = (phone: string): string => {
    let normalized = String(phone).trim();
    
    // Convert scientific notation to full number
    if (normalized.includes('E') || normalized.includes('e')) {
      const num = parseFloat(normalized);
      if (!isNaN(num)) {
        normalized = num.toFixed(0);
      }
    }
    
    // Remove any non-digit characters except leading +
    normalized = normalized.replace(/[^\d+]/g, '');
    
    return normalized;
  };


  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  const handleFileUpload = async () => {
    if (!selectedFile) {
      toast.error("Pilih file terlebih dahulu");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const file = selectedFile;
      setUploadProgress(5); // File reading started
      const data = await file.arrayBuffer();
      setUploadProgress(10); // File read complete
      // Handle CSV with custom delimiter (semicolon)
      const workbook = XLSX.read(data, { type: 'array', FS: ';' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
      setUploadProgress(15); // Parsing complete

      const processedData: any[] = [];
      const skippedDuplicates: string[] = [];
      const parsingErrors: string[] = [];
      const totalRows = (jsonData as any[]).length;

      for (let i = 0; i < totalRows; i++) {
        const row = (jsonData as any[])[i];
        // Update progress (15-85% for processing rows)
        const rowProgress = 15 + Math.floor((i / totalRows) * 70);
        setUploadProgress(rowProgress);
        // Map CSV columns to database fields
        const draftTime = row.draft_time || row.tanggal || row.Tanggal;
        const { date: tanggal, time: jam } = parseDateTimeFromCSV(draftTime);
        
        // Validate date
        if (!tanggal || isNaN(tanggal.getTime())) {
          console.warn('Invalid date for row:', { draftTime, row: row.name || row.order_id });
          parsingErrors.push(`Baris "${row.name || row.order_id}": tanggal "${draftTime}" tidak valid`);
          continue;
        }

        const nama = row.name || row.nama_client || row['Nama Client'] || '';
        
        // Parse phone number and convert scientific notation to full number
        let nohp = String(row.phone || row.nohp_client || row['NoHP Client'] || '').trim();
        // If scientific notation detected (e.g., "6.28524E+12"), convert it
        if (nohp.includes('E') || nohp.includes('e')) {
          const num = parseFloat(nohp);
          if (!isNaN(num)) {
            nohp = num.toFixed(0); // Convert to full integer string
          }
        }
        // Remove any non-digit characters except leading +
        nohp = nohp.replace(/[^\d+]/g, '');
        
        const sourceIklan = row.page || row.source_iklan || row['Source Iklan'] || '';
        const asalIklan = row.store || row.asal_iklan || row['Asal Iklan'] || '';
        const statusPayment = row.payment_status || row.status_payment || row['Status Payment'] || 'unpaid';
        
        const clientId = generateClientId(tanggal, nama, nohp, sourceIklan);
        
        console.log('Processing:', { 
          nama, 
          draftTime, 
          parsedDate: tanggal.toISOString().split('T')[0],
          parsedTime: jam,
          clientId 
        });
        
        // Check for duplicates in current batch
        if (processedData.some(d => d.client_id === clientId)) {
          skippedDuplicates.push(clientId);
          continue;
        }

        // Check if client_id already exists in database
        const { data: existing } = await supabase
          .from("sh2m_data")
          .select("client_id")
          .eq("client_id", clientId)
          .maybeSingle();

        if (existing) {
          skippedDuplicates.push(clientId);
          continue;
        }

        processedData.push({
          client_id: clientId,
          tanggal: toYMD(tanggal),
          jam: jam,
          nama_client: nama,
          nohp_client: nohp,
          source_iklan: sourceIklan,
          asal_iklan: asalIklan,
          nama_ec: row.nama_ec || row['Nama EC'] || '',
          tanggal_share: row.tanggal_share ? toYMD(new Date(row.tanggal_share)) : null,
          keterangan: row.keterangan || row.Keterangan || '',
          status_payment: statusPayment,
        });
      }

      if (parsingErrors.length > 0) {
        console.error('Parsing errors:', parsingErrors);
        toast.error(`Gagal parsing ${parsingErrors.length} baris. Check console untuk detail.`);
      }

      if (processedData.length === 0) {
        const message = skippedDuplicates.length > 0
          ? `Semua ${skippedDuplicates.length} data adalah duplikat. Upload file yang berbeda atau hapus data lama terlebih dahulu.`
          : "Tidak ada data valid untuk diupload. Pastikan format tanggal benar.";
        toast.error(message);
        console.log('Skipped duplicates:', skippedDuplicates);
        return;
      }

      setUploadProgress(90); // Starting database insert
      const { error } = await supabase.from("sh2m_data").insert(processedData);
      
      if (error) throw error;
      
      setUploadProgress(100); // Complete
      const message = skippedDuplicates.length > 0
        ? `${processedData.length} data berhasil diupload, ${skippedDuplicates.length} duplikat dilewati`
        : `${processedData.length} data berhasil diupload`;
      
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
      setUploadDialogOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error(error);
      toast.error("Gagal mengupload file");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleManualAdd = async (formData: FormData) => {
    const tanggal = new Date(formData.get("tanggal") as string);
    const nama = formData.get("nama_client") as string;
    const nohp = formData.get("nohp_client") as string;
    const sourceIklan = formData.get("source_iklan") as string;
    
    const newData = {
      client_id: generateClientId(tanggal, nama, nohp, sourceIklan),
      tanggal: toYMD(tanggal),
      jam: formData.get("jam") as string,
      nama_client: nama,
      nohp_client: nohp,
      source_iklan: sourceIklan,
      asal_iklan: formData.get("asal_iklan") as string,
      nama_ec: formData.get("nama_ec") as string,
      keterangan: formData.get("keterangan") as string,
      status_payment: formData.get("status_payment") as string || 'unpaid',
    };

    const { error } = await supabase.from("sh2m_data").insert(newData);
    
    if (error) {
      toast.error("Gagal menambahkan data");
      return;
    }
    
    toast.success("Data berhasil ditambahkan");
    queryClient.invalidateQueries({ queryKey: ["sh2m-data"] });
    setManualDialogOpen(false);
  };

  const handleDownloadData = () => {
    if (!sh2mData || sh2mData.length === 0) {
      toast.error("Tidak ada data untuk didownload");
      return;
    }

    const exportData = sh2mData.map(row => ({
      'Client ID': row.client_id,
      'Tanggal': row.tanggal,
      'Jam': row.jam || '',
      'Nama Client': row.nama_client,
      'No HP': row.nohp_client,
      'Source Iklan': row.source_iklan,
      'Kategori': row.kategori,
      'Asal Iklan': row.asal_iklan,
      'Nama EC': row.nama_ec || '',
      'Status Payment': row.status_payment,
      'Tanggal Share': row.tanggal_share || '',
      'Keterangan': row.keterangan || '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SH2M Data");
    XLSX.writeFile(wb, `SH2M_Data_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Data berhasil didownload");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Data Client Closing Iklan (SH2M)</h1>
          {isPreviewMode && (
            <p className="text-sm text-muted-foreground mt-1">
              Mode Preview - Menampilkan gabungan data dari semua cabang
            </p>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <MoreHorizontal className="mr-2 h-4 w-4" />
              Aksi
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-popover z-50">
            <DropdownMenuItem onClick={handleDownloadData} className="cursor-pointer">
              <Download className="mr-2 h-4 w-4" />
              Download Data
            </DropdownMenuItem>
            {!isPreviewMode && (
              <>
                <DropdownMenuItem 
                  onClick={() => setUploadDialogOpen(true)} 
                  className="cursor-pointer"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setManualDialogOpen(true)} 
                  className="cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Manual
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => setDeleteAllConfirm(true)} 
                  className="cursor-pointer text-destructive focus:text-destructive"
                  disabled={deleteAllMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus Semua Data
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Upload Dialog */}
        <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
          setUploadDialogOpen(open);
          if (!open) setSelectedFile(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Data dari File</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="file">Pilih File (Excel/CSV)</Label>
                <Input
                  id="file"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                />
                {selectedFile && (
                  <p className="text-sm text-primary mt-2">
                    File dipilih: {selectedFile.name}
                  </p>
                )}
                <p className="text-sm text-muted-foreground mt-2">
                  Kolom yang diperlukan: tanggal, nama_client, nohp_client, source_iklan, asal_iklan, nama_ec, keterangan
                </p>
              </div>
              {isUploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress Upload</span>
                    <span className="font-medium">{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2.5">
                    <div 
                      className="bg-primary h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <Button 
                onClick={handleFileUpload} 
                disabled={!selectedFile || isUploading}
                className="w-full"
              >
                {isUploading ? `Mengupload... ${uploadProgress}%` : "Submit"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        
        {/* Manual Add Dialog */}
        <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Tambah Data Manual</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => {
              e.preventDefault();
              handleManualAdd(new FormData(e.currentTarget));
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tanggal">Tanggal</Label>
                  <Input id="tanggal" name="tanggal" type="date" required />
                </div>
                <div>
                  <Label htmlFor="jam">Jam</Label>
                  <Input id="jam" name="jam" placeholder="HH.mm" />
                </div>
                <div>
                  <Label htmlFor="nama_client">Nama Client</Label>
                  <Input id="nama_client" name="nama_client" required />
                </div>
                <div>
                  <Label htmlFor="nohp_client">No HP Client</Label>
                  <Input id="nohp_client" name="nohp_client" required />
                </div>
                <div>
                  <Label htmlFor="source_iklan">Source Iklan</Label>
                  <Input id="source_iklan" name="source_iklan" required />
                </div>
                <div>
                  <Label htmlFor="asal_iklan">Asal Iklan</Label>
                  <Input id="asal_iklan" name="asal_iklan" />
                </div>
                <div>
                  <Label htmlFor="nama_ec">Nama EC</Label>
                  <Select name="nama_ec">
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih EC" />
                    </SelectTrigger>
                    <SelectContent>
                      {EC_OPTIONS.map((ec) => (
                        <SelectItem key={ec} value={ec}>{ec}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="status_payment">Status Payment</Label>
                  <Select name="status_payment" defaultValue="unpaid">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="unpaid">Unpaid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label htmlFor="keterangan">Keterangan</Label>
                  <Input id="keterangan" name="keterangan" />
                </div>
              </div>
              <Button type="submit" className="w-full">Tambah Data</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <div className={`flex-1 grid gap-4 ${isPreviewMode ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div>
              <Label htmlFor="filter-date">Filter Tanggal</Label>
              <Input
                id="filter-date"
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="filter-status">Filter Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=" ">Semua Status</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="filter-ec">Filter EC</Label>
              <Input
                id="filter-ec"
                placeholder="Nama EC"
                value={filterEC}
                onChange={(e) => setFilterEC(e.target.value)}
              />
            </div>
            {isPreviewMode && (
              <div>
                <Label htmlFor="filter-asal">Filter Asal Iklan</Label>
                <Select value={filterAsalIklan} onValueChange={setFilterAsalIklan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Asal Iklan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">Semua Asal Iklan</SelectItem>
                    <SelectItem value="SEFT Corp - Bekasi">SEFT Corp - Bekasi</SelectItem>
                    <SelectItem value="SEFT Corp - Jogja">SEFT Corp - Jogja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {(filterDate || filterStatus || filterEC || filterAsalIklan) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFilterDate("");
                setFilterStatus("");
                setFilterEC("");
                setFilterAsalIklan("");
              }}
            >
              Reset Filter
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Client ID</TableHead>
              <TableHead>Tanggal</TableHead>
              <TableHead>Jam</TableHead>
              <TableHead>Nama Client</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Source Iklan</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Asal Iklan</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Status Payment</TableHead>
              <TableHead>Tanggal Share</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : sh2mData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              sh2mData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>{formatIdDate(row.tanggal)}</TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Input
                        defaultValue={row.jam || ''}
                        placeholder="HH.mm"
                        onBlur={(e) => updateMutation.mutate({
                          id: row.id,
                          updates: { jam: e.target.value }
                        })}
                      />
                    ) : (
                      row.jam || '-'
                    )}
                  </TableCell>
                  <TableCell>{row.nama_client}</TableCell>
                  <TableCell>{row.nohp_client}</TableCell>
                  <TableCell>{row.source_iklan}</TableCell>
                  <TableCell>{row.kategori}</TableCell>
                  <TableCell>{row.asal_iklan}</TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Select
                        defaultValue={row.nama_ec || ''}
                        onValueChange={(value) => updateMutation.mutate({
                          id: row.id,
                          updates: { nama_ec: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih EC" />
                        </SelectTrigger>
                        <SelectContent>
                          {EC_OPTIONS.map((ec) => (
                            <SelectItem key={ec} value={ec}>{ec}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      row.nama_ec || '-'
                    )}
                  </TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Select
                        defaultValue={row.status_payment || 'unpaid'}
                        onValueChange={(value) => updateMutation.mutate({
                          id: row.id,
                          updates: { status_payment: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`px-2 py-1 rounded text-xs ${
                        row.status_payment === 'paid' 
                          ? 'bg-success/10 text-success' 
                          : 'bg-warning/10 text-warning'
                      }`}>
                        {row.status_payment}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingRow === row.id ? (
                      <Input
                        type="date"
                        defaultValue={row.tanggal_share || ''}
                        onBlur={(e) => updateMutation.mutate({
                          id: row.id,
                          updates: { tanggal_share: e.target.value }
                        })}
                      />
                    ) : (
                      row.tanggal_share ? new Date(row.tanggal_share).toLocaleDateString('id-ID') : '-'
                    )}
                  </TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                  <TableCell>
                    {!isPreviewMode && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingRow(editingRow === row.id ? null : row.id)}
                        >
                          {editingRow === row.id ? 'Selesai' : 'Edit'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirmId(row.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Delete Single Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={deleteAllConfirm} onOpenChange={setDeleteAllConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Hapus Semua Data</AlertDialogTitle>
            <AlertDialogDescription>
              {(filterDate || filterStatus || filterEC) ? (
                <>Apakah Anda yakin ingin menghapus semua data yang sesuai dengan filter saat ini? Data yang akan dihapus: {sh2mData?.length || 0} baris.</>
              ) : (
                <>Apakah Anda yakin ingin menghapus SEMUA data? Total data yang akan dihapus: {sh2mData?.length || 0} baris. Tindakan ini tidak dapat dibatalkan!</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
