-- Create function to sync source_iklan to categories table
CREATE OR REPLACE FUNCTION public.sync_source_iklan_to_categories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert source_iklan if not exists
  INSERT INTO public.source_iklan_categories (source_iklan, kategori)
  VALUES (NEW.source_iklan, NULL)
  ON CONFLICT (source_iklan) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Add unique constraint on source_iklan if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'source_iklan_categories_source_iklan_key'
  ) THEN
    ALTER TABLE public.source_iklan_categories 
    ADD CONSTRAINT source_iklan_categories_source_iklan_key UNIQUE (source_iklan);
  END IF;
END $$;

-- Create trigger on sh2m_data
DROP TRIGGER IF EXISTS sync_source_iklan_trigger ON public.sh2m_data;
CREATE TRIGGER sync_source_iklan_trigger
AFTER INSERT ON public.sh2m_data
FOR EACH ROW
EXECUTE FUNCTION public.sync_source_iklan_to_categories();