-- Create table for SH2M revenue data
CREATE TABLE public.sh2m_revenue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  tanggal DATE NOT NULL,
  nama_cs TEXT NOT NULL,
  jumlah_leads INTEGER NOT NULL DEFAULT 0,
  closing INTEGER NOT NULL DEFAULT 0,
  omset NUMERIC NOT NULL DEFAULT 0,
  keterangan TEXT,
  asal_iklan TEXT NOT NULL DEFAULT 'SEFT Corp - Jogja'
);

-- Enable RLS
ALTER TABLE public.sh2m_revenue ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access to sh2m_revenue" 
ON public.sh2m_revenue FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to sh2m_revenue" 
ON public.sh2m_revenue FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to sh2m_revenue" 
ON public.sh2m_revenue FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to sh2m_revenue" 
ON public.sh2m_revenue FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_sh2m_revenue_updated_at
BEFORE UPDATE ON public.sh2m_revenue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();