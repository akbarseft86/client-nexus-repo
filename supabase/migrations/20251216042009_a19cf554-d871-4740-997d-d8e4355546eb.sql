-- Add harga_bayar column to highticket_data table
ALTER TABLE public.highticket_data 
ADD COLUMN harga_bayar numeric DEFAULT NULL;