-- Update comments and email_tokens tables to use UUID type for article_id
ALTER TABLE public.comments 
  ALTER COLUMN article_id TYPE uuid USING article_id::uuid;

ALTER TABLE public.email_tokens
  ALTER COLUMN article_id TYPE uuid USING article_id::uuid;

-- Add foreign key constraints
ALTER TABLE public.comments
  ADD CONSTRAINT comments_article_id_fkey 
  FOREIGN KEY (article_id) 
  REFERENCES public.articles(id);

ALTER TABLE public.email_tokens
  ADD CONSTRAINT email_tokens_article_id_fkey 
  FOREIGN KEY (article_id) 
  REFERENCES public.articles(id);

-- Create temporary mapping table for legacy article IDs
CREATE TEMP TABLE article_id_mapping AS
SELECT DISTINCT 
  c.article_id as old_id,
  a.id as new_id
FROM public.comments c
LEFT JOIN public.articles a ON a.link = (
  SELECT link 
  FROM public.articles 
  WHERE created_at = (
    SELECT MIN(created_at) 
    FROM public.articles
  )
  LIMIT 1
)
WHERE c.article_id IS NOT NULL;

-- Update comments with mapped article IDs
UPDATE public.comments c
SET article_id = m.new_id
FROM article_id_mapping m
WHERE c.article_id::text = m.old_id::text;

-- Update email_tokens with mapped article IDs
UPDATE public.email_tokens e
SET article_id = m.new_id
FROM article_id_mapping m
WHERE e.article_id::text = m.old_id::text;

-- Drop temporary table
DROP TABLE article_id_mapping;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS comments_article_id_idx ON public.comments(article_id);
CREATE INDEX IF NOT EXISTS email_tokens_article_id_idx ON public.email_tokens(article_id); 