-- Create user_sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
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

-- Add RLS policies
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (needed for the extension)
CREATE POLICY "Allow anonymous inserts"
  ON user_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow users to read their own sessions
CREATE POLICY "Users can read own sessions"
  ON user_sessions
  FOR SELECT
  TO anon
  USING (email = current_user);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_sessions_updated_at
    BEFORE UPDATE ON user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 