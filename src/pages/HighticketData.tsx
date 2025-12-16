import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Download, Filter, Pencil, Upload, Image, X, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format, parseISO, isValid } from "date-fns";
import { id } from "date-fns/locale";
import { useBranch } from "@/contexts/BranchContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";

const formatPelaksanaanProgram = (value: string | null): string => {
  if (!value) return '-';
  try {
    const date = parseISO(value);
    if (isValid(date)) {
      return format(date, "dd MMMM yyyy", { locale: id });
    }
    return value;
  } catch {
    return value;
  }
};
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

// Indonesian month names mapping
const INDONESIAN_MONTHS: { [key: string]: number } = {
  'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
  'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
};

// Parse date from various formats for file upload
const parseDateFromFile = (input: any): Date | null => {
  if (input == null) return null;
  const str = String(input).trim();
  if (!str) return null;

  // Try ISO format: YYYY-MM-DD
  const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = str.match(isoRegex);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // Try Indonesian text format: "1 Juni 2025" or "01 Juni 2025"
  const indoTextRegex = /^(\d{1,2})\s+(\w+)\s+(\d{4})$/i;
  const indoTextMatch = str.match(indoTextRegex);
  if (indoTextMatch) {
    const day = parseInt(indoTextMatch[1], 10);
    const monthName = indoTextMatch[2].toLowerCase();
    const year = parseInt(indoTextMatch[3], 10);
    const month = INDONESIAN_MONTHS[monthName];
    if (month !== undefined) {
      return new Date(year, month, day);
    }
  }

  // Try Indonesian numeric format: DD/MM/YY(YY)
  const indoRegex = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})$/;
  const indoMatch = str.match(indoRegex);
  if (indoMatch) {
    let year = parseInt(indoMatch[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, parseInt(indoMatch[2]) - 1, parseInt(indoMatch[1]));
  }

  // Try parsing as Date
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
};

// Parse Indonesian price format: "Rp385.000" or "Rp2.000.000"
const parsePriceFromFile = (input: any): number => {
  if (input == null) return 0;
  const str = String(input).trim();
  if (!str) return 0;
  // Remove "Rp", dots (thousand separator), and spaces
  const cleaned = str.replace(/[Rp\s.]/gi, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export default function HighticketData() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingData, setEditingData] = useState<any>(null);
  const [searchClientId, setSearchClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [viewImageUrl, setViewImageUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);
  
  // Upload file states
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Filter states
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterStatusPayment, setFilterStatusPayment] = useState("all");
  const [filterNamaEC, setFilterNamaEC] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  
  const { getBranchFilter, selectedBranch } = useBranch();
  const branchFilter = getBranchFilter();
  const isPreviewMode = selectedBranch === "SEFT ALL";
  
  const queryClient = useQueryClient();

  const uploadImage = async (file: File, recordId: string): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${recordId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('bukti-transfer')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }

    const { data } = supabase.storage
      .from('bukti-transfer')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const { data: highticketData, isLoading } = useQuery({
    queryKey: ["highticket-data", branchFilter],
    queryFn: async () => {
      // First get client_ids from sh2m_data filtered by branch
      let clientQuery = supabase.from("sh2m_data").select("client_id");
      if (branchFilter) {
        clientQuery = clientQuery.eq("asal_iklan", branchFilter);
      }
      const { data: sh2mClients, error: sh2mError } = await clientQuery;
      if (sh2mError) throw sh2mError;
      
      const clientIds = sh2mClients?.map(c => c.client_id) || [];
      
      // If branch filter is active and no clients found, return empty
      if (branchFilter && clientIds.length === 0) {
        return [];
      }

      let query = supabase
        .from("highticket_data")
        .select("*")
        .order("tanggal_transaksi", { ascending: false });
      
      // Filter by client_ids from branch
      if (branchFilter && clientIds.length > 0) {
        query = query.in("client_id", clientIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["sh2m-clients", branchFilter],
    queryFn: async () => {
      let query = supabase
        .from("sh2m_data")
        .select("client_id, nama_client, nohp_client, tanggal")
        .order("nama_client");
      
      if (branchFilter) {
        query = query.eq("asal_iklan", branchFilter);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const searchClient = async (searchTerm: string) => {
    // Try to search by client_id first
    let { data, error } = await supabase
      .from("sh2m_data")
      .select("*")
      .eq("client_id", searchTerm)
      .maybeSingle();
    
    // If not found, try searching by phone number
    if (!data && searchTerm) {
      const { data: phoneData, error: phoneError } = await supabase
        .from("sh2m_data")
        .select("*")
        .eq("nohp_client", searchTerm)
        .maybeSingle();
      
      data = phoneData;
      error = phoneError;
    }
    
    if (error || !data) {
      toast.error("Client tidak ditemukan");
      setSelectedClient(null);
      return;
    }
    
    setSelectedClient(data);
    toast.success("Client ditemukan");
  };

  const addMutation = useMutation({
    mutationFn: async ({ formData, imageFile }: { formData: FormData; imageFile: File | null }) => {
      const newData: any = {
        tanggal_transaksi: formData.get("tanggal_transaksi") as string,
        client_id: formData.get("client_id") as string,
        nama: formData.get("nama") as string,
        nohp: formData.get("nohp") as string,
        category: formData.get("category") as string,
        nama_program: formData.get("nama_program") as string,
        harga: parseFloat(formData.get("harga") as string),
        status_payment: formData.get("status_payment") as string,
        nama_ec: formData.get("nama_ec") as string,
        tanggal_sh2m: formData.get("tanggal_sh2m") as string || null,
        pelaksanaan_program: formData.get("pelaksanaan_program") as string,
        keterangan: formData.get("keterangan") as string,
      };

      const { data, error } = await supabase.from("highticket_data").insert(newData).select().single();
      if (error) throw error;

      // Upload image if provided
      if (imageFile && data) {
        const imageUrl = await uploadImage(imageFile, data.id);
        if (imageUrl) {
          await supabase
            .from("highticket_data")
            .update({ bukti_transfer: imageUrl })
            .eq("id", data.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
      toast.success("Data berhasil ditambahkan");
      setDialogOpen(false);
      setSelectedClient(null);
      setSearchClientId("");
      setPreviewImage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    onError: () => {
      toast.error("Gagal menambahkan data");
    },
  });

  const deleteDataMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("highticket_data")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
      toast.success("Data berhasil dihapus");
      setDeleteConfirmId(null);
    },
    onError: () => {
      toast.error("Gagal menghapus data");
      setDeleteConfirmId(null);
    },
  });

  const editMutation = useMutation({
    mutationFn: async (data: { id: string; formData: FormData; imageFile?: File | null }) => {
      const updateData: any = {
        tanggal_transaksi: data.formData.get("tanggal_transaksi") as string,
        client_id: data.formData.get("client_id") as string,
        nama: data.formData.get("nama") as string,
        nohp: data.formData.get("nohp") as string,
        category: data.formData.get("category") as string,
        nama_program: data.formData.get("nama_program") as string,
        harga: parseFloat(data.formData.get("harga") as string),
        status_payment: data.formData.get("status_payment") as string,
        nama_ec: data.formData.get("nama_ec") as string,
        tanggal_sh2m: data.formData.get("tanggal_sh2m") as string || null,
        pelaksanaan_program: data.formData.get("pelaksanaan_program") as string,
        keterangan: data.formData.get("keterangan") as string,
      };

      // Upload new image if provided
      if (data.imageFile) {
        const imageUrl = await uploadImage(data.imageFile, data.id);
        if (imageUrl) {
          updateData.bukti_transfer = imageUrl;
        }
      }

      const { error } = await supabase
        .from("highticket_data")
        .update(updateData)
        .eq("id", data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
      toast.success("Data berhasil diperbarui");
      setEditDialogOpen(false);
      setEditingData(null);
      setPreviewImage(null);
      if (editFileInputRef.current) editFileInputRef.current.value = '';
    },
    onError: () => {
      toast.error("Gagal memperbarui data");
    },
  });

  const handleEdit = (row: any) => {
    setEditingData(row);
    setEditDialogOpen(true);
  };

  // Filter data
  const filteredData = highticketData?.filter((row) => {
    // Filter by date range
    if (filterDateFrom && new Date(row.tanggal_transaksi) < new Date(filterDateFrom)) return false;
    if (filterDateTo && new Date(row.tanggal_transaksi) > new Date(filterDateTo)) return false;
    
    // Filter by status payment
    if (filterStatusPayment !== "all" && row.status_payment !== filterStatusPayment) return false;
    
    // Filter by nama EC
    if (filterNamaEC && !row.nama_ec?.toLowerCase().includes(filterNamaEC.toLowerCase())) return false;
    
    // Filter by category
    if (filterCategory !== "all" && row.category !== filterCategory) return false;
    
    return true;
  });

  const handleExportExcel = () => {
    if (!filteredData || filteredData.length === 0) {
      toast.error("Tidak ada data untuk diexport");
      return;
    }

    const exportData = filteredData.map((row) => ({
      "Tanggal Transaksi": new Date(row.tanggal_transaksi).toLocaleDateString('id-ID'),
      "Client ID": row.client_id,
      "Nama": row.nama,
      "No HP": row.nohp,
      "Category": row.category,
      "Nama Program": row.nama_program,
      "Harga": row.harga,
      "Status Payment": row.status_payment,
      "Nama EC": row.nama_ec,
      "Tanggal SH2M": row.tanggal_sh2m ? new Date(row.tanggal_sh2m).toLocaleDateString('id-ID') : '-',
      "Pelaksanaan Program": formatPelaksanaanProgram(row.pelaksanaan_program),
      "Keterangan": row.keterangan || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Highticket Data");
    
    const fileName = `highticket_data_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success("Data berhasil diexport");
  };

  const clearFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterStatusPayment("all");
    setFilterNamaEC("");
    setFilterCategory("all");
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
      setUploadProgress(5);
      const data = await selectedFile.arrayBuffer();
      setUploadProgress(10);
      const workbook = XLSX.read(data, { type: 'array', FS: ';' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
      setUploadProgress(15);

      // Fetch SH2M data for client ID lookup by phone
      const { data: sh2mData } = await supabase
        .from("sh2m_data")
        .select("client_id, nohp_client");
      
      // Create phone to client_id map
      const phoneToClientId = new Map<string, string>();
      sh2mData?.forEach(item => {
        const normalizedPhone = String(item.nohp_client).replace(/[^\d]/g, '');
        if (normalizedPhone && item.client_id) {
          phoneToClientId.set(normalizedPhone, item.client_id);
        }
      });

      setUploadProgress(20);

      const processedData: any[] = [];
      const parsingErrors: string[] = [];
      const totalRows = (jsonData as any[]).length;

      for (let i = 0; i < totalRows; i++) {
        const row = (jsonData as any[])[i];
        const rowProgress = 20 + Math.floor((i / totalRows) * 65);
        setUploadProgress(rowProgress);

        // Map columns - support user's CSV format:
        // Tanggal (Indonesian text: "1 Juni 2025"), Nama, NoHP, Product, Price (Rp385.000),
        // Status Payment, Closing by, SH2M Leads EC, Kode Unik, Keterangan
        const tanggalTransaksi = parseDateFromFile(
          row.tanggal_transaksi || row['Tanggal Transaksi'] || row.tanggal || row.Tanggal ||
          row['Tanggal'] || row['Date']
        );
        
        if (!tanggalTransaksi) {
          parsingErrors.push(`Baris ${i + 1}: tanggal tidak valid`);
          continue;
        }

        // Get nama - support multiple column names
        const nama = (row.nama || row.Nama || row.name || row.Name || '').trim();
        
        // Get phone number - support "NoHP" column
        const rawPhone = row.nohp || row['No HP'] || row.NoHP || row.phone || row.Phone || row['No. HP'] || '';
        const nohp = String(rawPhone).replace(/[^\d]/g, '');
        
        // Get client ID - try "Kode Unik" first, then lookup by phone
        let clientId = row['Kode Unik'] || row.client_id || row['Client ID'] || row.ClientID || row.client || '';
        if (!clientId && nohp) {
          // Lookup client_id from sh2m_data by phone number
          clientId = phoneToClientId.get(nohp) || '';
          // If still no client_id, generate one based on date and phone
          if (!clientId && nohp.length >= 4) {
            const dateStr = format(tanggalTransaksi, 'yyMMdd');
            const phoneSuffix = nohp.slice(-4);
            clientId = `${dateStr}-${phoneSuffix}-H`;
          }
        }
        
        // Category - default to 'Program'
        const category = row.category || row.Category || row.Kategori || 'Program';
        
        // Product/Program name - support "Product" column
        const namaProgram = row.nama_program || row['Nama Program'] || row.Product || row.product || row.Program || '';
        
        // Price/Harga - use parsePriceFromFile for "Rp385.000" format
        const harga = parsePriceFromFile(row.harga || row.Harga || row.Price || row.price);
        
        // Status Payment
        const statusPayment = row.status_payment || row['Status Payment'] || row.StatusPayment || row.Status || 'Lunas';
        
        // EC Name - support "Closing by" column (note: there's also "Nama EC" column in the file)
        const namaEc = row['Closing by'] || row['Closing By'] || row.nama_ec || row['Nama EC'] || row.ClosingBy || '';
        
        // Tanggal SH2M - support "SH2M Leads EC" column (DD/MM/YYYY format like "15/05/2025")
        const tanggalSh2m = parseDateFromFile(
          row['SH2M Leads EC'] || row.tanggal_sh2m || row['Tanggal SH2M'] || row['SH2M'] || row.SH2M
        );
        
        // Pelaksanaan Program
        const pelaksanaanProgram = parseDateFromFile(row.pelaksanaan_program || row['Pelaksanaan Program']);
        
        // Keterangan
        const keterangan = row.keterangan || row.Keterangan || row.Notes || row.notes || '';

        // Validate required fields - only nama is required, client_id can be generated
        if (!nama) {
          parsingErrors.push(`Baris ${i + 1}: nama kosong`);
          continue;
        }

        processedData.push({
          tanggal_transaksi: toYMD(tanggalTransaksi),
          client_id: clientId || `AUTO-${i + 1}`,
          nama: nama,
          nohp: nohp,
          category: category,
          nama_program: namaProgram,
          harga: harga,
          status_payment: statusPayment,
          nama_ec: namaEc,
          tanggal_sh2m: tanggalSh2m ? toYMD(tanggalSh2m) : null,
          pelaksanaan_program: pelaksanaanProgram ? toYMD(pelaksanaanProgram) : null,
          keterangan: keterangan,
        });
      }

      if (parsingErrors.length > 0) {
        console.error('Parsing errors:', parsingErrors);
        toast.error(`${parsingErrors.length} baris gagal diparse`);
      }

      if (processedData.length === 0) {
        toast.error("Tidak ada data valid untuk diupload");
        return;
      }

      setUploadProgress(90);
      const { error } = await supabase.from("highticket_data").insert(processedData);
      
      if (error) throw error;
      
      setUploadProgress(100);
      toast.success(`${processedData.length} data berhasil diupload`);
      queryClient.invalidateQueries({ queryKey: ["highticket-data"] });
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Data Client Highticket</h1>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportExcel}>
                <Download className="mr-2 h-4 w-4" />
                Download Data
              </DropdownMenuItem>
              {!isPreviewMode && (
                <>
                  <DropdownMenuItem onClick={() => setUploadDialogOpen(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload File
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Tambah Manual
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Upload Dialog */}
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload File Highticket Data</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Pilih File (Excel/CSV)</Label>
                  <Input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    className="mt-2"
                  />
                </div>
                {selectedFile && (
                  <p className="text-sm text-muted-foreground">
                    File: {selectedFile.name}
                  </p>
                )}
                {isUploading && (
                  <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-2" />
                    <p className="text-sm text-muted-foreground text-center">
                      {uploadProgress}%
                    </p>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  <p>Kolom yang didukung:</p>
                  <p>tanggal_transaksi, client_id, nama, nohp, category, nama_program, harga, status_payment, nama_ec, tanggal_sh2m, pelaksanaan_program, keterangan</p>
                </div>
                <Button 
                  onClick={handleFileUpload} 
                  disabled={!selectedFile || isUploading}
                  className="w-full"
                >
                  {isUploading ? `Uploading... ${uploadProgress}%` : "Upload"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Manual Add Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Data Client Highticket</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label htmlFor="search-client">Cari Client ID atau No HP</Label>
                  <Input
                    id="search-client"
                    placeholder="Masukkan Client ID atau No HP"
                    value={searchClientId}
                    onChange={(e) => setSearchClientId(e.target.value)}
                  />
                </div>
                <Button
                  className="mt-auto"
                  onClick={() => searchClient(searchClientId)}
                >
                  Cari
                </Button>
              </div>

              {selectedClient && (
                <Card className="p-4 bg-muted">
                  <p className="text-sm"><strong>Nama:</strong> {selectedClient.nama_client}</p>
                  <p className="text-sm"><strong>No HP:</strong> {selectedClient.nohp_client}</p>
                  <p className="text-sm"><strong>Client ID:</strong> {selectedClient.client_id}</p>
                  <p className="text-sm"><strong>Tanggal SH2M:</strong> {selectedClient.tanggal ? new Date(selectedClient.tanggal).toLocaleDateString('id-ID') : '-'}</p>
                </Card>
              )}

              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const imageFile = fileInputRef.current?.files?.[0] || null;
                addMutation.mutate({ formData, imageFile });
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tanggal_transaksi">Tanggal Transaksi</Label>
                    <Input id="tanggal_transaksi" name="tanggal_transaksi" type="date" required />
                  </div>
                  <div>
                    <Label htmlFor="client_id">Client ID</Label>
                    <Input 
                      id="client_id" 
                      name="client_id" 
                      value={selectedClient?.client_id || ''} 
                      onChange={(e) => {
                        if (selectedClient) {
                          setSelectedClient({ ...selectedClient, client_id: e.target.value });
                        }
                      }}
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="nama">Nama</Label>
                    <Input 
                      id="nama" 
                      name="nama" 
                      defaultValue={selectedClient?.nama_client || ''} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="nohp">No HP</Label>
                    <Input 
                      id="nohp" 
                      name="nohp" 
                      defaultValue={selectedClient?.nohp_client || ''} 
                      required 
                    />
                  </div>
                  <div>
                    <Label htmlFor="category">Category</Label>
                    <Select name="category" defaultValue="Program" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Program">Program</SelectItem>
                        <SelectItem value="Merchandise">Merchandise</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nama_program">Nama Program</Label>
                    <Input id="nama_program" name="nama_program" required />
                  </div>
                  <div>
                    <Label htmlFor="harga">Harga</Label>
                    <Input id="harga" name="harga" type="number" required />
                  </div>
                  <div>
                    <Label htmlFor="status_payment">Status Payment</Label>
                    <Select name="status_payment" defaultValue="Lunas" required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Lunas">Lunas</SelectItem>
                        <SelectItem value="DP">DP</SelectItem>
                        <SelectItem value="Angsuran">Angsuran</SelectItem>
                        <SelectItem value="Pelunasan">Pelunasan</SelectItem>
                        <SelectItem value="Bonus">Bonus</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="nama_ec">Nama EC</Label>
                    <Input id="nama_ec" name="nama_ec" required />
                  </div>
                  <div>
                    <Label htmlFor="tanggal_sh2m">Tanggal SH2M</Label>
                    <Input 
                      id="tanggal_sh2m" 
                      name="tanggal_sh2m" 
                      type="date" 
                      defaultValue={selectedClient?.tanggal || ''} 
                      readOnly={!!selectedClient?.tanggal}
                      className={selectedClient?.tanggal ? "bg-muted" : ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="pelaksanaan_program">Pelaksanaan Program</Label>
                    <Input id="pelaksanaan_program" name="pelaksanaan_program" type="date" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="keterangan">Keterangan</Label>
                    <Input id="keterangan" name="keterangan" />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="bukti_transfer">Bukti Transfer</Label>
                    <div className="flex gap-2 items-center">
                      <Input 
                        id="bukti_transfer" 
                        type="file" 
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (e) => setPreviewImage(e.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                        className="cursor-pointer"
                      />
                    </div>
                    {previewImage && (
                      <div className="mt-2 relative inline-block">
                        <img 
                          src={previewImage} 
                          alt="Preview" 
                          className="max-h-32 rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => {
                            setPreviewImage(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={addMutation.isPending}>
                  {addMutation.isPending ? "Menyimpan..." : "Simpan Data"}
                </Button>
              </form>
            </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter Section */}
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        <div className="flex items-center justify-between">
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter Data
            </Button>
          </CollapsibleTrigger>
          <Button variant="outline" onClick={handleExportExcel} className="gap-2">
            <Download className="h-4 w-4" />
            Export Excel ({filteredData?.length || 0} data)
          </Button>
        </div>
        <CollapsibleContent className="mt-4">
          <Card className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <Label htmlFor="filterDateFrom">Dari Tanggal</Label>
                <Input
                  id="filterDateFrom"
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterDateTo">Sampai Tanggal</Label>
                <Input
                  id="filterDateTo"
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="filterStatusPayment">Status Payment</Label>
                <Select value={filterStatusPayment} onValueChange={setFilterStatusPayment}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="Lunas">Lunas</SelectItem>
                    <SelectItem value="DP">DP</SelectItem>
                    <SelectItem value="Angsuran">Angsuran</SelectItem>
                    <SelectItem value="Pelunasan">Pelunasan</SelectItem>
                    <SelectItem value="Bonus">Bonus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterCategory">Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="Program">Program</SelectItem>
                    <SelectItem value="Merchandise">Merchandise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="filterNamaEC">Nama EC</Label>
                <Input
                  id="filterNamaEC"
                  placeholder="Cari nama EC..."
                  value={filterNamaEC}
                  onChange={(e) => setFilterNamaEC(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="ghost" onClick={clearFilters}>
                Reset Filter
              </Button>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tanggal Transaksi</TableHead>
              <TableHead>Client ID</TableHead>
              <TableHead>Nama</TableHead>
              <TableHead>No HP</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Nama Program</TableHead>
              <TableHead>Harga</TableHead>
              <TableHead>Status Payment</TableHead>
              <TableHead>Nama EC</TableHead>
              <TableHead>Tanggal SH2M</TableHead>
              <TableHead>Pelaksanaan Program</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead>Bukti Transfer</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredData?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center">Tidak ada data</TableCell>
              </TableRow>
            ) : (
              filteredData?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{new Date(row.tanggal_transaksi).toLocaleDateString('id-ID')}</TableCell>
                  <TableCell className="font-medium">{row.client_id}</TableCell>
                  <TableCell>{row.nama}</TableCell>
                  <TableCell>{row.nohp}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.category === 'Program' 
                        ? 'bg-primary/10 text-primary' 
                        : 'bg-accent/10 text-accent'
                    }`}>
                      {row.category}
                    </span>
                  </TableCell>
                  <TableCell>{row.nama_program}</TableCell>
                  <TableCell>Rp {row.harga.toLocaleString('id-ID')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${
                      row.status_payment === 'Lunas' 
                        ? 'bg-success/10 text-success' 
                        : row.status_payment === 'DP' || row.status_payment === 'Angsuran'
                        ? 'bg-warning/10 text-warning'
                        : row.status_payment === 'Pelunasan'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {row.status_payment}
                    </span>
                  </TableCell>
                  <TableCell>{row.nama_ec}</TableCell>
                  <TableCell>
                    {row.tanggal_sh2m ? new Date(row.tanggal_sh2m).toLocaleDateString('id-ID') : '-'}
                  </TableCell>
                  <TableCell>
                    {formatPelaksanaanProgram(row.pelaksanaan_program)}
                  </TableCell>
                  <TableCell>{row.keterangan}</TableCell>
                  <TableCell>
                    {row.bukti_transfer ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewImageUrl(row.bukti_transfer)}
                        className="gap-1"
                      >
                        <Image className="h-4 w-4" />
                        Lihat
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(row)}
                      >
                        <Pencil className="h-4 w-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmId(row.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Data Client Highticket</DialogTitle>
          </DialogHeader>
          
          {editingData && (
            <form onSubmit={(e) => {
              e.preventDefault();
              const imageFile = editFileInputRef.current?.files?.[0] || null;
              editMutation.mutate({ id: editingData.id, formData: new FormData(e.currentTarget), imageFile });
            }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_tanggal_transaksi">Tanggal Transaksi</Label>
                  <Input 
                    id="edit_tanggal_transaksi" 
                    name="tanggal_transaksi" 
                    type="date" 
                    defaultValue={editingData.tanggal_transaksi}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_client_id">Client ID</Label>
                  <Input 
                    id="edit_client_id" 
                    name="client_id" 
                    defaultValue={editingData.client_id}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_nama">Nama</Label>
                  <Input 
                    id="edit_nama" 
                    name="nama" 
                    defaultValue={editingData.nama}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_nohp">No HP</Label>
                  <Input 
                    id="edit_nohp" 
                    name="nohp" 
                    defaultValue={editingData.nohp}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_category">Category</Label>
                  <Select name="category" defaultValue={editingData.category} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Program">Program</SelectItem>
                      <SelectItem value="Merchandise">Merchandise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_nama_program">Nama Program</Label>
                  <Input 
                    id="edit_nama_program" 
                    name="nama_program" 
                    defaultValue={editingData.nama_program}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_harga">Harga</Label>
                  <Input 
                    id="edit_harga" 
                    name="harga" 
                    type="number" 
                    defaultValue={editingData.harga}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_status_payment">Status Payment</Label>
                  <Select name="status_payment" defaultValue={editingData.status_payment} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Lunas">Lunas</SelectItem>
                      <SelectItem value="DP">DP</SelectItem>
                      <SelectItem value="Angsuran">Angsuran</SelectItem>
                      <SelectItem value="Pelunasan">Pelunasan</SelectItem>
                      <SelectItem value="Bonus">Bonus</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_nama_ec">Nama EC</Label>
                  <Input 
                    id="edit_nama_ec" 
                    name="nama_ec" 
                    defaultValue={editingData.nama_ec}
                    required 
                  />
                </div>
                <div>
                  <Label htmlFor="edit_tanggal_sh2m">Tanggal SH2M</Label>
                  <Input 
                    id="edit_tanggal_sh2m" 
                    name="tanggal_sh2m" 
                    type="date" 
                    defaultValue={editingData.tanggal_sh2m || ''}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_pelaksanaan_program">Pelaksanaan Program</Label>
                  <Input 
                    id="edit_pelaksanaan_program" 
                    name="pelaksanaan_program" 
                    type="date"
                    defaultValue={editingData.pelaksanaan_program || ''}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit_keterangan">Keterangan</Label>
                  <Input 
                    id="edit_keterangan" 
                    name="keterangan" 
                    defaultValue={editingData.keterangan || ''}
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="edit_bukti_transfer">Bukti Transfer</Label>
                  {editingData.bukti_transfer && (
                    <div className="mb-2">
                      <p className="text-sm text-muted-foreground mb-1">Foto saat ini:</p>
                      <img 
                        src={editingData.bukti_transfer} 
                        alt="Bukti transfer" 
                        className="max-h-32 rounded border"
                      />
                    </div>
                  )}
                  <Input 
                    id="edit_bukti_transfer" 
                    type="file" 
                    accept="image/*"
                    ref={editFileInputRef}
                    className="cursor-pointer"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Pilih file baru untuk mengganti foto
                  </p>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={editMutation.isPending}>
                {editMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
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
              onClick={() => deleteConfirmId && deleteDataMutation.mutate(deleteConfirmId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!viewImageUrl} onOpenChange={(open) => !open && setViewImageUrl(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Bukti Transfer</DialogTitle>
          </DialogHeader>
          {viewImageUrl && (
            <div className="flex justify-center">
              <img 
                src={viewImageUrl} 
                alt="Bukti transfer" 
                className="max-h-[70vh] rounded"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
