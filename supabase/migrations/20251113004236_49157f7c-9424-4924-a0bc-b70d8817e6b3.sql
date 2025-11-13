-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  ad_product TEXT,
  purchase_date DATE,
  ec_name TEXT,
  paid_description TEXT,
  ad_payment_status TEXT CHECK (ad_payment_status IN ('paid', 'unpaid')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  closing_date DATE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  unique_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  price NUMERIC NOT NULL,
  payment_status TEXT NOT NULL CHECK (payment_status IN ('DP', 'Lunas', 'Pelunasan', 'Angsuran', 'Cicilan')),
  ec_name TEXT NOT NULL,
  days_to_closing INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (no authentication required for this CRM)
CREATE POLICY "Allow public read access to clients"
  ON public.clients FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to clients"
  ON public.clients FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to clients"
  ON public.clients FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to clients"
  ON public.clients FOR DELETE
  USING (true);

CREATE POLICY "Allow public read access to products"
  ON public.products FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert access to products"
  ON public.products FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update access to products"
  ON public.products FOR UPDATE
  USING (true);

CREATE POLICY "Allow public delete access to products"
  ON public.products FOR DELETE
  USING (true);

-- Create indexes for better search performance
CREATE INDEX idx_clients_client_id ON public.clients(client_id);
CREATE INDEX idx_clients_phone ON public.clients(phone);
CREATE INDEX idx_products_client_id ON public.products(client_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();