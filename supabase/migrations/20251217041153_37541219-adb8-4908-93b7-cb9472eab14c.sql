-- Create program_name_mappings table
CREATE TABLE public.program_name_mappings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nama_program_original TEXT NOT NULL UNIQUE,
  nama_standar TEXT,
  pelaksanaan TEXT,
  suffix TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.program_name_mappings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access to program_name_mappings" 
ON public.program_name_mappings FOR SELECT USING (true);

CREATE POLICY "Allow public insert access to program_name_mappings" 
ON public.program_name_mappings FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access to program_name_mappings" 
ON public.program_name_mappings FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access to program_name_mappings" 
ON public.program_name_mappings FOR DELETE USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_program_name_mappings_updated_at
BEFORE UPDATE ON public.program_name_mappings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add new columns to highticket_data
ALTER TABLE public.highticket_data 
ADD COLUMN nama_program_standar TEXT,
ADD COLUMN suffix_program TEXT;

-- Create function to sync nama_program to mappings table
CREATE OR REPLACE FUNCTION public.sync_nama_program_to_mappings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Insert nama_program if not exists
  INSERT INTO public.program_name_mappings (nama_program_original)
  VALUES (NEW.nama_program)
  ON CONFLICT (nama_program_original) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-sync new nama_program
CREATE TRIGGER sync_highticket_nama_program
AFTER INSERT ON public.highticket_data
FOR EACH ROW
EXECUTE FUNCTION public.sync_nama_program_to_mappings();

-- Populate mappings table with existing unique nama_program values
INSERT INTO public.program_name_mappings (nama_program_original)
SELECT DISTINCT nama_program FROM public.highticket_data
WHERE nama_program IS NOT NULL AND nama_program != ''
ON CONFLICT (nama_program_original) DO NOTHING;