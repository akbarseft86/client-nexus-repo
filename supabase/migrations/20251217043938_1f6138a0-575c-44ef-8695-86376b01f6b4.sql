-- Add category column to program_name_mappings
ALTER TABLE public.program_name_mappings 
ADD COLUMN IF NOT EXISTS category text;