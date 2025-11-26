-- Rename tanggal_update_paid to tanggal_share in sh2m_data table
ALTER TABLE public.sh2m_data 
RENAME COLUMN tanggal_update_paid TO tanggal_share;