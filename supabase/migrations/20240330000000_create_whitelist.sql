-- Create the whitelist table
CREATE TABLE IF NOT EXISTS whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add initial whitelist domains
INSERT INTO whitelist (domain) VALUES
  ('tandfonline.com'),
  ('onlinelibrary.wiley.com'),
  ('sciencedirect.com'),
  ('journals.sagepub.com');

-- Create an index for faster domain lookups
CREATE INDEX IF NOT EXISTS idx_whitelist_domain ON whitelist(domain);

-- Add RLS policies
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read the whitelist
CREATE POLICY "Allow public read access to whitelist" ON whitelist
  FOR SELECT TO anon
  USING (true);

-- Only allow authenticated users with specific roles to modify the whitelist
CREATE POLICY "Allow admins to modify whitelist" ON whitelist
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin'); 