-- Add category column to highticket_data table
ALTER TABLE public.highticket_data 
ADD COLUMN category text NOT NULL DEFAULT 'Program' CHECK (category IN ('Program', 'Merchandise'));