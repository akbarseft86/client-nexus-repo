-- Add branch association to highticket_data so branch filtering doesn't depend on SH2M client_id matching
ALTER TABLE public.highticket_data
ADD COLUMN IF NOT EXISTS asal_iklan text;

CREATE INDEX IF NOT EXISTS idx_hightticket_data_asal_iklan
ON public.highticket_data (asal_iklan);
