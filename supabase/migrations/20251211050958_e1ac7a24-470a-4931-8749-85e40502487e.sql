-- Create table for tracking installment payments history
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  highticket_id UUID NOT NULL REFERENCES public.highticket_data(id) ON DELETE CASCADE,
  tanggal_bayar DATE NOT NULL,
  jumlah_bayar NUMERIC NOT NULL,
  keterangan TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access to payment_history" 
ON public.payment_history 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to payment_history" 
ON public.payment_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to payment_history" 
ON public.payment_history 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to payment_history" 
ON public.payment_history 
FOR DELETE 
USING (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_payment_history_updated_at
BEFORE UPDATE ON public.payment_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();