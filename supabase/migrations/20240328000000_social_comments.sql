-- Create social comments table
CREATE TABLE IF NOT EXISTS social_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID NOT NULL REFERENCES articles(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE social_comments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can read social comments" ON social_comments;
DROP POLICY IF EXISTS "Authenticated users can insert their own comments" ON social_comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON social_comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON social_comments;

-- Create policies
CREATE POLICY "Anyone can read social comments"
  ON social_comments
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert their own comments"
  ON social_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments"
  ON social_comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments"
  ON social_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS social_comments_article_id_idx ON social_comments(article_id);
CREATE INDEX IF NOT EXISTS social_comments_user_id_idx ON social_comments(user_id); 