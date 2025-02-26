-- Add missing columns to comments table
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS token uuid REFERENCES public.email_tokens(token),
  ADD COLUMN IF NOT EXISTS message_id text,
  ADD COLUMN IF NOT EXISTS correlation_id uuid,
  ADD COLUMN IF NOT EXISTS webhook_type text,
  ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS dkim text,
  ADD COLUMN IF NOT EXISTS spf text,
  ADD COLUMN IF NOT EXISTS sender_ip text,
  ADD COLUMN IF NOT EXISTS raw_headers jsonb;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS comments_token_idx ON public.comments(token);
CREATE INDEX IF NOT EXISTS comments_message_id_idx ON public.comments(message_id);
CREATE INDEX IF NOT EXISTS comments_correlation_id_idx ON public.comments(correlation_id);

-- Add unique constraint to prevent duplicate comments
ALTER TABLE public.comments
  ADD CONSTRAINT unique_token_message_id UNIQUE NULLS NOT DISTINCT (token, message_id); 