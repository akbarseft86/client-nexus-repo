import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, Trash2, Check, AlertCircle, Pencil, X, ArrowRight, Filter } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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

// Indonesian month names mapping
const INDONESIAN_MONTHS: { [key: string]: number } = {
  'januari': 0, 'februari': 1, 'maret': 2, 'april': 3, 'mei': 4, 'juni': 5,
  'juli': 6, 'agustus': 7, 'september': 8, 'oktober': 9, 'november': 10, 'desember': 11
};

// Normalize phone number to 628xxxxxxxxx format
const normalizePhoneNumber = (phone: string | null): string => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  
  // Handle scientific notation
  if (String(phone).includes('E') || String(phone).includes('e')) {
    const num = parseFloat(String(phone));
    if (!isNaN(num)) {
      cleaned = Math.round(num).toString();
    }
  }
  
  // Normalize to 628xxxxxxxxx
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
};

// Parse date from various formats
const parseDateFromFile = (input: any): Date | null => {
  if (input == null) return null;
  const str = String(input).trim();
  if (!str) return null;

  // Try ISO format
  const isoRegex = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
  const isoMatch = str.match(isoRegex);
  if (isoMatch) {
    return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
  }

  // Try Indonesian text format: "1 Juni 2025"
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

// Parse price format
const parsePriceFromFile = (input: any): number => {
  if (input == null) return 0;
  const str = String(input).trim();
  if (!str) return 0;
  const cleaned = str.replace(/[Rp\s.]/gi, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
};

const toYMD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface StagingData {
  id: string;
  tanggal_transaksi: string;
  client_id: string;
  nama: string;
  nohp: string;
  nohp_original: string;
  nama_program: string;
  harga: number;
  harga_bayar: number | null;
  status_payment: string;
  nama_ec: string;
  tanggal_sh2m: string | null;
  pelaksanaan_program: string | null;
  keterangan: string | null;
  category: string;
  asal_iklan: string;
  // Validation status
  validation: {
    nohp_valid: boolean;
    nama_valid: boolean;
    tanggal_valid: boolean;
    harga_valid: boolean;
    nama_ec_valid: boolean;
    status_payment_valid: boolean;
  };
}

// Website column definitions
interface ColumnMapping {
  key: string;
  label: string;
  required: boolean;
  fileColumn: string;
}

const WEBSITE_COLUMNS: { key: string; label: string; required: boolean }[] = [
  { key: 'tanggal_transaksi', label: 'Tanggal Transaksi', required: true },
  { key: 'nama', label: 'Nama', required: true },
  { key: 'nohp', label: 'No HP', required: true },
  { key: 'nama_program', label: 'Nama Program', required: false },
  { key: 'harga', label: 'Harga', required: true },
  { key: 'status_payment', label: 'Status Payment', required: true },
  { key: 'nama_ec', label: 'Nama EC', required: true },
  { key: 'category', label: 'Category', required: false },
  { key: 'tanggal_sh2m', label: 'Tanggal SH2M', required: false },
  { key: 'client_id', label: 'ID Client', required: false },
  { key: 'keterangan', label: 'Keterangan', required: false },
];

const EC_NAMES = ["Farah", "Intan", "Rizki", "Sefhia", "Yola"];
const PAYMENT_STATUS_OPTIONS = ["Lunas", "DP", "Angsuran", "Pelunasan", "Bonus"];
const CATEGORY_OPTIONS = ["Program", "Merchandise"];

export default function DataStaging() {
  const [stagingData, setStagingData] = useState<StagingData[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [editData, setEditData] = useState<StagingData | null>(null);
  const [targetBranch, setTargetBranch] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [confirmAssign, setConfirmAssign] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [showOnlyInvalid, setShowOnlyInvalid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping states
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawFileData, setRawFileData] = useState<any[]>([]);
  const [columnMappings, setColumnMappings] = useState<{ [key: string]: string }>({});

  const validateRow = (row: Partial<StagingData>): StagingData['validation'] => {
    return {
      nohp_valid: !!(row.nohp && row.nohp.length >= 10 && row.nohp.startsWith('62')),
      nama_valid: !!(row.nama && row.nama.trim().length > 0),
      tanggal_valid: !!(row.tanggal_transaksi),
      harga_valid: !!(row.harga && row.harga > 0),
      nama_ec_valid: !!(row.nama_ec && row.nama_ec.trim().length > 0),
      status_payment_valid: !!(row.status_payment && PAYMENT_STATUS_OPTIONS.includes(row.status_payment)),
    };
  };

  const getValidationScore = (validation: StagingData['validation']): number => {
    const fields = Object.values(validation);
    return fields.filter(Boolean).length;
  };

  const isRowValid = (validation: StagingData['validation']): boolean => {
    return Object.values(validation).every(Boolean);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(10);

    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadProgress(30);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (jsonData.length === 0) {
          toast.error("File kosong atau tidak valid");
          setIsUploading(false);
          setUploadProgress(0);
          return;
        }

        // Extract headers from first row
        const headers = Object.keys(jsonData[0] as object);
        setFileHeaders(headers);
        setRawFileData(jsonData);

        // Auto-detect common mappings
        const autoMappings: { [key: string]: string } = {};
        headers.forEach(header => {
          const headerLower = header.toLowerCase().trim();
          
          if (headerLower === 'tanggal' || headerLower === 'tanggal transaksi' || headerLower === 'date') {
            autoMappings['tanggal_transaksi'] = header;
          } else if (headerLower === 'nama' || headerLower === 'name' || headerLower === 'nama client') {
            autoMappings['nama'] = header;
          } else if (headerLower === 'nohp' || headerLower === 'no hp' || headerLower === 'phone' || headerLower === 'no. hp' || headerLower === 'nomor hp') {
            autoMappings['nohp'] = header;
          } else if (headerLower === 'product' || headerLower === 'nama program' || headerLower === 'program') {
            autoMappings['nama_program'] = header;
          } else if (headerLower === 'price' || headerLower === 'harga') {
            autoMappings['harga'] = header;
          } else if (headerLower === 'status payment' || headerLower === 'status' || headerLower === 'payment status') {
            autoMappings['status_payment'] = header;
          } else if (headerLower === 'closing by' || headerLower === 'nama ec' || headerLower === 'ec') {
            autoMappings['nama_ec'] = header;
          } else if (headerLower === 'category' || headerLower === 'kategori') {
            autoMappings['category'] = header;
          } else if (headerLower === 'sh2m leads ec' || headerLower === 'tanggal sh2m' || headerLower === 'tanggal_sh2m') {
            autoMappings['tanggal_sh2m'] = header;
          } else if (headerLower === 'kode unik' || headerLower === 'client_id' || headerLower === 'id client') {
            autoMappings['client_id'] = header;
          } else if (headerLower === 'keterangan' || headerLower === 'notes' || headerLower === 'catatan') {
            autoMappings['keterangan'] = header;
          }
        });

        setColumnMappings(autoMappings);
        setShowColumnMapping(true);
        setUploadProgress(100);
        setIsUploading(false);
        toast.success(`File berhasil dibaca. ${headers.length} kolom ditemukan.`);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error reading file:", error);
      toast.error("Gagal membaca file");
      setIsUploading(false);
      setUploadProgress(0);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleMappingChange = (websiteColumn: string, fileColumn: string) => {
    setColumnMappings(prev => ({
      ...prev,
      [websiteColumn]: fileColumn === '_none_' ? '' : fileColumn
    }));
  };

  const processDataWithMapping = () => {
    if (rawFileData.length === 0) {
      toast.error("Tidak ada data untuk diproses");
      return;
    }

    // Check required columns
    const requiredColumns = WEBSITE_COLUMNS.filter(col => col.required);
    const missingRequired = requiredColumns.filter(col => !columnMappings[col.key]);
    if (missingRequired.length > 0) {
      toast.error(`Kolom wajib belum dipetakan: ${missingRequired.map(c => c.label).join(', ')}`);
      return;
    }

    const processedData: StagingData[] = [];

    rawFileData.forEach((row: any, index: number) => {
      // Get values based on mapping
      const tanggalRaw = columnMappings['tanggal_transaksi'] ? row[columnMappings['tanggal_transaksi']] : '';
      const tanggalParsed = parseDateFromFile(tanggalRaw);
      const tanggalStr = tanggalParsed ? toYMD(tanggalParsed) : '';

      const sh2mRaw = columnMappings['tanggal_sh2m'] ? row[columnMappings['tanggal_sh2m']] : '';
      const sh2mParsed = parseDateFromFile(sh2mRaw);
      const sh2mStr = sh2mParsed ? toYMD(sh2mParsed) : null;

      const nohpOriginal = columnMappings['nohp'] ? String(row[columnMappings['nohp']] || '') : '';
      const nohpNormalized = normalizePhoneNumber(nohpOriginal);

      const hargaRaw = columnMappings['harga'] ? row[columnMappings['harga']] : 0;
      const harga = parsePriceFromFile(hargaRaw);

      // Generate client ID
      const datePart = tanggalParsed 
        ? `${String(tanggalParsed.getFullYear()).slice(-2)}${String(tanggalParsed.getMonth() + 1).padStart(2, '0')}${String(tanggalParsed.getDate()).padStart(2, '0')}`
        : 'XXXXXX';
      const phonePart = nohpNormalized.slice(-4).padStart(4, '0');
      const sourceInitial = 'X';
      const clientIdFromFile = columnMappings['client_id'] ? row[columnMappings['client_id']] : '';
      const clientId = clientIdFromFile || `${datePart}-${phonePart}-${sourceInitial}`;

      const nama = columnMappings['nama'] ? String(row[columnMappings['nama']] || '').trim() : '';
      const namaProgram = columnMappings['nama_program'] ? String(row[columnMappings['nama_program']] || '').trim() : '';
      const statusPayment = columnMappings['status_payment'] ? String(row[columnMappings['status_payment']] || 'Lunas').trim() : 'Lunas';
      const namaEc = columnMappings['nama_ec'] ? String(row[columnMappings['nama_ec']] || '').trim() : '';
      const category = columnMappings['category'] ? String(row[columnMappings['category']] || 'Program').trim() : 'Program';
      const keterangan = columnMappings['keterangan'] ? String(row[columnMappings['keterangan']] || '').trim() : '';

      const stagingRow: StagingData = {
        id: `staging-${Date.now()}-${index}`,
        tanggal_transaksi: tanggalStr,
        client_id: clientId,
        nama,
        nohp: nohpNormalized,
        nohp_original: nohpOriginal,
        nama_program: namaProgram,
        harga,
        harga_bayar: statusPayment === 'DP' ? harga : null,
        status_payment: statusPayment,
        nama_ec: namaEc,
        tanggal_sh2m: sh2mStr,
        pelaksanaan_program: null,
        keterangan: keterangan || null,
        category: CATEGORY_OPTIONS.includes(category) ? category : 'Program',
        asal_iklan: '',
        validation: { nohp_valid: false, nama_valid: false, tanggal_valid: false, harga_valid: false, nama_ec_valid: false, status_payment_valid: false }
      };

      stagingRow.validation = validateRow(stagingRow);
      processedData.push(stagingRow);
    });

    setStagingData(processedData);
    setShowColumnMapping(false);
    setFileHeaders([]);
    setRawFileData([]);
    setColumnMappings({});
    toast.success(`${processedData.length} data berhasil dimuat ke staging`);
  };

  const cancelColumnMapping = () => {
    setShowColumnMapping(false);
    setFileHeaders([]);
    setRawFileData([]);
    setColumnMappings({});
  };

  const handleEditRow = (row: StagingData) => {
    setEditingRow(row.id);
    setEditData({ ...row });
  };

  const handleSaveEdit = () => {
    if (!editData) return;
    
    // Re-normalize phone if changed
    if (editData.nohp !== editData.nohp_original) {
      editData.nohp = normalizePhoneNumber(editData.nohp);
    }
    
    editData.validation = validateRow(editData);
    
    setStagingData(prev => 
      prev.map(row => row.id === editData.id ? editData : row)
    );
    setEditingRow(null);
    setEditData(null);
    toast.success("Data berhasil diupdate");
  };

  const handleDeleteRow = (id: string) => {
    setStagingData(prev => prev.filter(row => row.id !== id));
    setDeleteConfirmId(null);
    toast.success("Data dihapus dari staging");
  };

  const handleDeleteAll = () => {
    setStagingData([]);
    setConfirmDeleteAll(false);
    toast.success("Semua data staging dihapus");
  };

  const handleAssignToBranch = async () => {
    if (!targetBranch) {
      toast.error("Pilih cabang tujuan terlebih dahulu");
      return;
    }

    const validData = stagingData.filter(row => isRowValid(row.validation));
    if (validData.length === 0) {
      toast.error("Tidak ada data valid untuk di-assign");
      return;
    }

    setIsAssigning(true);
    try {
      const asalIklan = targetBranch === "bekasi" ? "SEFT Corp - Bekasi" : "SEFT Corp - Jogja";
      
      const dataToInsert = validData.map(row => ({
        tanggal_transaksi: row.tanggal_transaksi,
        client_id: row.client_id,
        nama: row.nama,
        nohp: row.nohp,
        nama_program: row.nama_program,
        harga: row.harga,
        harga_bayar: row.harga_bayar,
        status_payment: row.status_payment,
        nama_ec: row.nama_ec,
        tanggal_sh2m: row.tanggal_sh2m,
        pelaksanaan_program: row.pelaksanaan_program,
        keterangan: row.keterangan,
        category: row.category,
        asal_iklan: asalIklan,
      }));

      const { error } = await supabase
        .from('highticket_data')
        .insert(dataToInsert);

      if (error) throw error;

      toast.success(`${validData.length} data berhasil dipindahkan ke ${targetBranch === "bekasi" ? "SEFT Bekasi" : "SEFT Jogja"}`);
      
      // Remove assigned data from staging
      const assignedIds = new Set(validData.map(row => row.id));
      setStagingData(prev => prev.filter(row => !assignedIds.has(row.id)));
      setTargetBranch("");
      setConfirmAssign(false);
    } catch (error) {
      console.error("Error assigning data:", error);
      toast.error("Gagal memindahkan data ke cabang");
    } finally {
      setIsAssigning(false);
    }
  };

  const validCount = stagingData.filter(row => isRowValid(row.validation)).length;
  const invalidCount = stagingData.length - validCount;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Data Staging</h1>
          <p className="text-muted-foreground">Upload, bersihkan, dan review data sebelum assign ke cabang</p>
        </div>
      </div>

      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Upload File</CardTitle>
          <CardDescription>Upload file Excel/CSV untuk dibersihkan sebelum dipindahkan ke cabang</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="max-w-sm"
            />
            {isUploading && (
              <div className="flex-1 max-w-xs">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground mt-1">{uploadProgress}%</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Column Mapping Section */}
      {showColumnMapping && (
        <Card className="border-primary">
          <CardHeader className="bg-primary/5">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Pemetaan Kolom
            </CardTitle>
            <CardDescription>
              Petakan kolom website dengan kolom dari file yang diupload. Kolom bertanda (*) wajib dipetakan.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-2 gap-4 pb-2 border-b font-medium text-sm">
                <div className="text-foreground">Kolom Website</div>
                <div className="text-foreground">Kolom dari File</div>
              </div>
              
              {/* Mapping rows */}
              {WEBSITE_COLUMNS.map((col) => (
                <div key={col.key} className="grid grid-cols-2 gap-4 items-center">
                  <div className="flex items-center gap-2">
                    <span className={col.required ? "font-medium" : "text-muted-foreground"}>
                      {col.label}
                    </span>
                    {col.required && <span className="text-destructive">*</span>}
                  </div>
                  <Select 
                    value={columnMappings[col.key] || '_none_'} 
                    onValueChange={(v) => handleMappingChange(col.key, v)}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Pilih kolom..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      <SelectItem value="_none_">-- Tidak dipetakan --</SelectItem>
                      {fileHeaders.map(header => (
                        <SelectItem key={header} value={header}>{header}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* File preview info */}
              <div className="mt-4 p-3 bg-muted rounded-md">
                <p className="text-sm text-muted-foreground">
                  <strong>Info File:</strong> {rawFileData.length} baris data ditemukan dengan {fileHeaders.length} kolom
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Kolom ditemukan: {fileHeaders.join(', ')}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={cancelColumnMapping}>
                  Batal
                </Button>
                <Button onClick={processDataWithMapping}>
                  <Check className="h-4 w-4 mr-2" />
                  Proses Data
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {stagingData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Data</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stagingData.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Data Valid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{validCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Perlu Perbaikan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{invalidCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Assign ke Cabang</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-2">
              <Select value={targetBranch} onValueChange={setTargetBranch}>
                <SelectTrigger className="w-32 bg-background">
                  <SelectValue placeholder="Pilih" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="bekasi">Bekasi</SelectItem>
                  <SelectItem value="jogja">Jogja</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={() => setConfirmAssign(true)} 
                disabled={validCount === 0 || !targetBranch}
                size="sm"
              >
                <Check className="h-4 w-4 mr-1" />
                Assign
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Staging Table */}
      {stagingData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Data Staging</CardTitle>
                <CardDescription>
                  Review dan edit data sebelum di-assign. Baris merah menandakan data tidak valid.
                </CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="filter-invalid" 
                    checked={showOnlyInvalid}
                    onCheckedChange={(checked) => setShowOnlyInvalid(checked === true)}
                  />
                  <label 
                    htmlFor="filter-invalid" 
                    className="text-sm font-medium cursor-pointer flex items-center gap-1"
                  >
                    <Filter className="h-4 w-4" />
                    Hanya Perlu Diperbaiki ({invalidCount})
                  </label>
                </div>
                {showOnlyInvalid && invalidCount > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => {
                      const invalidIds = stagingData
                        .filter(row => !isRowValid(row.validation))
                        .map(row => row.id);
                      setStagingData(prev => prev.filter(row => !invalidIds.includes(row.id)));
                      setShowOnlyInvalid(false);
                      toast.success(`${invalidIds.length} data invalid berhasil dihapus`);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Hapus Invalid ({invalidCount})
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => setConfirmDeleteAll(true)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Hapus Semua
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[60px]">Status</TableHead>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>No HP</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Harga</TableHead>
                    <TableHead>Status Payment</TableHead>
                    <TableHead>Nama EC</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="w-[100px]">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagingData
                    .filter(row => !showOnlyInvalid || !isRowValid(row.validation))
                    .map((row) => {
                    const isValid = isRowValid(row.validation);
                    return (
                      <TableRow 
                        key={row.id} 
                        className={!isValid ? "bg-red-50 dark:bg-red-950/20" : ""}
                      >
                        <TableCell>
                          {isValid ? (
                            <Badge variant="default" className="bg-green-600">
                              <Check className="h-3 w-3" />
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertCircle className="h-3 w-3" />
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={!row.validation.tanggal_valid ? "text-red-600 font-medium" : ""}>
                          {row.tanggal_transaksi || "-"}
                        </TableCell>
                        <TableCell className={!row.validation.nama_valid ? "text-red-600 font-medium" : ""}>
                          {row.nama || "-"}
                        </TableCell>
                        <TableCell className={!row.validation.nohp_valid ? "text-red-600 font-medium" : ""}>
                          <div className="text-xs">
                            <div>{row.nohp || "-"}</div>
                            {row.nohp !== row.nohp_original && (
                              <div className="text-muted-foreground">dari: {row.nohp_original}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{row.nama_program || "-"}</TableCell>
                        <TableCell className={!row.validation.harga_valid ? "text-red-600 font-medium" : ""}>
                          {row.harga?.toLocaleString('id-ID') || "-"}
                        </TableCell>
                        <TableCell className={!row.validation.status_payment_valid ? "text-red-600 font-medium" : ""}>
                          {row.status_payment || "-"}
                        </TableCell>
                        <TableCell className={!row.validation.nama_ec_valid ? "text-red-600 font-medium" : ""}>
                          {row.nama_ec || "-"}
                        </TableCell>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleEditRow(row)}
                            >
                              <Pencil className="h-4 w-4" />
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
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingRow} onOpenChange={() => { setEditingRow(null); setEditData(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Data</DialogTitle>
          </DialogHeader>
          {editData && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tanggal Transaksi</Label>
                <Input
                  type="date"
                  value={editData.tanggal_transaksi}
                  onChange={(e) => setEditData({ ...editData, tanggal_transaksi: e.target.value })}
                />
              </div>
              <div>
                <Label>Nama</Label>
                <Input
                  value={editData.nama}
                  onChange={(e) => setEditData({ ...editData, nama: e.target.value })}
                />
              </div>
              <div>
                <Label>No HP</Label>
                <Input
                  value={editData.nohp}
                  onChange={(e) => setEditData({ ...editData, nohp: e.target.value })}
                />
                {editData.nohp !== editData.nohp_original && (
                  <p className="text-xs text-muted-foreground mt-1">Original: {editData.nohp_original}</p>
                )}
              </div>
              <div>
                <Label>Nama Program</Label>
                <Input
                  value={editData.nama_program}
                  onChange={(e) => setEditData({ ...editData, nama_program: e.target.value })}
                />
              </div>
              <div>
                <Label>Harga</Label>
                <Input
                  type="number"
                  value={editData.harga}
                  onChange={(e) => setEditData({ ...editData, harga: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Status Payment</Label>
                <Select 
                  value={editData.status_payment} 
                  onValueChange={(v) => setEditData({ ...editData, status_payment: v, harga_bayar: v === 'DP' ? editData.harga : null })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {PAYMENT_STATUS_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Nama EC</Label>
                <Select 
                  value={editData.nama_ec} 
                  onValueChange={(v) => setEditData({ ...editData, nama_ec: v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih EC" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {EC_NAMES.map(name => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={editData.category} 
                  onValueChange={(v) => setEditData({ ...editData, category: v })}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    {CATEGORY_OPTIONS.map(opt => (
                      <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Keterangan</Label>
                <Input
                  value={editData.keterangan || ''}
                  onChange={(e) => setEditData({ ...editData, keterangan: e.target.value || null })}
                />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditingRow(null); setEditData(null); }}>
                  Batal
                </Button>
                <Button onClick={handleSaveEdit}>
                  Simpan
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Row Confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Data akan dihapus dari staging area. Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirmId && handleDeleteRow(deleteConfirmId)}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation */}
      <AlertDialog open={confirmDeleteAll} onOpenChange={setConfirmDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Semua Data?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua {stagingData.length} data di staging area akan dihapus. Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Confirmation */}
      <AlertDialog open={confirmAssign} onOpenChange={setConfirmAssign}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Data ke Cabang?</AlertDialogTitle>
            <AlertDialogDescription>
              {validCount} data valid akan dipindahkan ke {targetBranch === "bekasi" ? "SEFT Bekasi" : "SEFT Jogja"}.
              {invalidCount > 0 && ` ${invalidCount} data invalid akan tetap di staging.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAssigning}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleAssignToBranch} disabled={isAssigning}>
              {isAssigning ? "Memproses..." : "Assign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
