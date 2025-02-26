-- Add image_url column to experts table
ALTER TABLE public.experts ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Insert test expert
INSERT INTO public.experts (email, name, title, organization)
VALUES ('sean.w.meehan@gmail.com', 'Sean Meehan', 'Test Expert', 'Test Organization')
ON CONFLICT (email) DO UPDATE 
SET name = EXCLUDED.name,
    title = EXCLUDED.title,
    organization = EXCLUDED.organization; 