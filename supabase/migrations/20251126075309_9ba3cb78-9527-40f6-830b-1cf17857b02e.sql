-- Create table for source iklan categories
CREATE TABLE public.source_iklan_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_iklan text NOT NULL UNIQUE,
  kategori text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.source_iklan_categories ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to source_iklan_categories" 
ON public.source_iklan_categories 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to source_iklan_categories" 
ON public.source_iklan_categories 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to source_iklan_categories" 
ON public.source_iklan_categories 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to source_iklan_categories" 
ON public.source_iklan_categories 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_source_iklan_categories_updated_at
BEFORE UPDATE ON public.source_iklan_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();