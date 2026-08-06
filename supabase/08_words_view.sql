-- supabase/08_words_view.sql
-- Security fix: Create a view that exposes only non-sensitive word fields (id, length, status)
-- Players will query this view or we apply RLS column filtering.

CREATE OR REPLACE VIEW public_words AS
  SELECT id, length, status
  FROM words;

-- Grant SELECT access to authenticated/anon roles
GRANT SELECT ON public_words TO authenticated, anon;
