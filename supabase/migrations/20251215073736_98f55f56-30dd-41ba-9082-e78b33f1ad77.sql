-- Create table to store admin decisions for duplicate data ownership
CREATE TABLE public.duplicate_branch_assignments (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    duplicate_key text NOT NULL,
    duplicate_type text NOT NULL DEFAULT 'phone',
    assigned_branch text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    UNIQUE(duplicate_key, duplicate_type)
);

-- Enable RLS
ALTER TABLE public.duplicate_branch_assignments ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow public read access to duplicate_branch_assignments" 
ON public.duplicate_branch_assignments 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access to duplicate_branch_assignments" 
ON public.duplicate_branch_assignments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public update access to duplicate_branch_assignments" 
ON public.duplicate_branch_assignments 
FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete access to duplicate_branch_assignments" 
ON public.duplicate_branch_assignments 
FOR DELETE 
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_duplicate_branch_assignments_updated_at
BEFORE UPDATE ON public.duplicate_branch_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();