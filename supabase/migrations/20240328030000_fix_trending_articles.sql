-- Ensure trending_rank is not null for trending articles
UPDATE public.articles
SET trending_rank = (
  SELECT COALESCE(MAX(trending_rank), 0) + 1 
  FROM public.articles 
  WHERE is_trending = true
)
WHERE is_trending = true AND trending_rank IS NULL;

-- Create function to maintain trending ranks
CREATE OR REPLACE FUNCTION maintain_trending_ranks()
RETURNS TRIGGER AS $$
BEGIN
  -- If article becomes trending, assign next rank
  IF NEW.is_trending = true AND (OLD.is_trending = false OR OLD.is_trending IS NULL) THEN
    NEW.trending_rank := (
      SELECT COALESCE(MAX(trending_rank), 0) + 1 
      FROM public.articles 
      WHERE is_trending = true
    );
  END IF;

  -- If article is no longer trending, remove rank
  IF NEW.is_trending = false AND OLD.is_trending = true THEN
    NEW.trending_rank := NULL;
    
    -- Reorder remaining trending articles
    UPDATE public.articles
    SET trending_rank = subquery.new_rank
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY trending_rank) as new_rank
      FROM public.articles
      WHERE is_trending = true AND id != OLD.id
    ) as subquery
    WHERE articles.id = subquery.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for maintaining trending ranks
DROP TRIGGER IF EXISTS trending_rank_maintenance ON public.articles;
CREATE TRIGGER trending_rank_maintenance
  BEFORE UPDATE ON public.articles
  FOR EACH ROW
  WHEN (OLD.is_trending IS DISTINCT FROM NEW.is_trending)
  EXECUTE FUNCTION maintain_trending_ranks();

-- Add constraint to ensure trending articles have a rank
ALTER TABLE public.articles
  ADD CONSTRAINT trending_articles_must_have_rank
  CHECK (NOT (is_trending = true AND trending_rank IS NULL)); 