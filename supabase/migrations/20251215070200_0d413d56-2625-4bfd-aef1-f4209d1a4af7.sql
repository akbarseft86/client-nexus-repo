-- Add column for transfer proof image
ALTER TABLE public.highticket_data 
ADD COLUMN bukti_transfer TEXT NULL;

-- Create storage bucket for transfer proofs
INSERT INTO storage.buckets (id, name, public)
VALUES ('bukti-transfer', 'bukti-transfer', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for the bucket
CREATE POLICY "Allow public read access to bukti-transfer"
ON storage.objects FOR SELECT
USING (bucket_id = 'bukti-transfer');

CREATE POLICY "Allow public insert access to bukti-transfer"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'bukti-transfer');

CREATE POLICY "Allow public update access to bukti-transfer"
ON storage.objects FOR UPDATE
USING (bucket_id = 'bukti-transfer');

CREATE POLICY "Allow public delete access to bukti-transfer"
ON storage.objects FOR DELETE
USING (bucket_id = 'bukti-transfer');