import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AddClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AddClientDialog = ({ open, onOpenChange }: AddClientDialogProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError("");
    setPreviewData([]);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);

        if (jsonData.length === 0) {
          setError("File Excel kosong atau tidak valid");
          return;
        }

        // Validate required columns
        const firstRow: any = jsonData[0];
        const requiredColumns = ["client_id", "name", "phone"];
        const missingColumns = requiredColumns.filter(col => !(col in firstRow));
        
        if (missingColumns.length > 0) {
          setError(`Kolom yang wajib ada: ${missingColumns.join(", ")}`);
          return;
        }

        setPreviewData(jsonData.slice(0, 5)); // Show first 5 rows
      } catch (err) {
        setError("Error membaca file. Pastikan format Excel benar.");
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleSubmit = async () => {
    if (!file || previewData.length === 0) {
      setError("Silakan pilih file Excel terlebih dahulu");
      return;
    }

    setLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);

          // Transform and validate data
          const clientsData = jsonData.map((row) => ({
            client_id: row.client_id?.toString() || "",
            name: row.name?.toString() || "",
            phone: row.phone?.toString() || "",
            email: row.email?.toString() || null,
            ad_product: row.ad_product?.toString() || null,
            purchase_date: row.purchase_date ? new Date(row.purchase_date).toISOString().split('T')[0] : null,
            ec_name: row.ec_name?.toString() || null,
            paid_description: row.paid_description?.toString() || null,
            ad_payment_status: row.ad_payment_status?.toString().toLowerCase() === "paid" ? "paid" : "unpaid",
          }));

          const { error } = await supabase.from("clients").insert(clientsData);

          if (error) throw error;

          toast({
            title: "Berhasil!",
            description: `${clientsData.length} client berhasil ditambahkan`,
          });

          queryClient.invalidateQueries({ queryKey: ["clientsCount"] });
          onOpenChange(false);
          setFile(null);
          setPreviewData([]);
          setError("");
        } catch (err: any) {
          toast({
            title: "Error",
            description: err.message,
            variant: "destructive",
          });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Data Client dari Excel</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-primary/10 rounded-full">
                    <FileSpreadsheet className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">
                      {file ? file.name : "Klik untuk upload file Excel"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Format: .xlsx, .xls, .csv
                    </p>
                  </div>
                </div>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </Label>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {previewData.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Preview Data (5 baris pertama):</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-4 py-2 text-left">ID Client</th>
                          <th className="px-4 py-2 text-left">Nama</th>
                          <th className="px-4 py-2 text-left">No HP</th>
                          <th className="px-4 py-2 text-left">Email</th>
                          <th className="px-4 py-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row: any, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-4 py-2">{row.client_id}</td>
                            <td className="px-4 py-2">{row.name}</td>
                            <td className="px-4 py-2">{row.phone}</td>
                            <td className="px-4 py-2">{row.email || "-"}</td>
                            <td className="px-4 py-2">
                              <span className={row.ad_payment_status === "paid" ? "text-success" : "text-warning"}>
                                {row.ad_payment_status || "unpaid"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Total: {previewData.length} baris (menampilkan 5 baris pertama)
                </p>
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Format Excel yang diperlukan:</p>
                <ul className="text-xs space-y-1 list-disc list-inside">
                  <li><strong>client_id</strong> (wajib): ID unik client</li>
                  <li><strong>name</strong> (wajib): Nama lengkap</li>
                  <li><strong>phone</strong> (wajib): Nomor telepon</li>
                  <li><strong>email</strong>: Email client</li>
                  <li><strong>ad_product</strong>: Nama produk iklan</li>
                  <li><strong>purchase_date</strong>: Tanggal pembelian (format: YYYY-MM-DD)</li>
                  <li><strong>ec_name</strong>: Nama EC</li>
                  <li><strong>paid_description</strong>: Keterangan pembayaran</li>
                  <li><strong>ad_payment_status</strong>: paid atau unpaid</li>
                </ul>
              </AlertDescription>
            </Alert>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={loading || previewData.length === 0}
            >
              {loading ? "Mengimport..." : `Import ${previewData.length} Client`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddClientDialog;
