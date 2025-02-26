-- Fix article IDs in comments table
UPDATE public.comments
SET article_id = TRIM(article_id)
WHERE article_id LIKE '%\n';

-- Update article_id in email_tokens to match actual article IDs
UPDATE public.email_tokens
SET article_id = '012c1834-c1a0-4d06-a224-8edd77fc3a62'
WHERE article_id = 'test-123'; 