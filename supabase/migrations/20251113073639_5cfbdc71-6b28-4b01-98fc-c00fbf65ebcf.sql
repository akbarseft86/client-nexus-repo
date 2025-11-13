-- Drop existing tables
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;

-- Create sh2m_data table (Data client closing iklan)
CREATE TABLE public.sh2m_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT UNIQUE NOT NULL,
  tanggal DATE NOT NULL,
  nama_client TEXT NOT NULL,
  nohp_client TEXT NOT NULL,
  source_iklan TEXT NOT NULL,
  asal_iklan TEXT,
  nama_ec TEXT,
  tanggal_update_paid DATE,
  keterangan TEXT,
  status_payment TEXT DEFAULT 'unpaid',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create highticket_data table (Data client yang membeli program)
CREATE TABLE public.highticket_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal_transaksi DATE NOT NULL,
  client_id TEXT NOT NULL,
  nama TEXT NOT NULL,
  nohp TEXT NOT NULL,
  nama_program TEXT NOT NULL,
  harga NUMERIC NOT NULL,
  status_payment TEXT NOT NULL DEFAULT 'unpaid',
  nama_ec TEXT NOT NULL,
  tanggal_sh2m DATE,
  pelaksanaan_program TEXT,
  keterangan TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sh2m_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.highticket_data ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sh2m_data
CREATE POLICY "Allow public read access to sh2m_data"
ON public.sh2m_data FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to sh2m_data"
ON public.sh2m_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to sh2m_data"
ON public.sh2m_data FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to sh2m_data"
ON public.sh2m_data FOR DELETE USING (true);

-- Create RLS policies for highticket_data
CREATE POLICY "Allow public read access to highticket_data"
ON public.highticket_data FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to highticket_data"
ON public.highticket_data FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to highticket_data"
ON public.highticket_data FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to highticket_data"
ON public.highticket_data FOR DELETE USING (true);

-- Create triggers for updated_at
CREATE TRIGGER update_sh2m_data_updated_at
BEFORE UPDATE ON public.sh2m_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_highticket_data_updated_at
BEFORE UPDATE ON public.highticket_data
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();