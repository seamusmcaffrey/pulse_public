-- Create the updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create the table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    last_sign_in TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    provider TEXT NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.user_sessions;
DROP POLICY IF EXISTS "Allow anonymous reads" ON public.user_sessions;
DROP POLICY IF EXISTS "Allow anonymous updates" ON public.user_sessions;

-- Create policies
CREATE POLICY "Allow anonymous inserts" ON public.user_sessions
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Allow anonymous reads" ON public.user_sessions
    FOR SELECT TO anon USING (true);

CREATE POLICY "Allow anonymous updates" ON public.user_sessions
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Create the trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_user_sessions_updated_at ON public.user_sessions;
CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 