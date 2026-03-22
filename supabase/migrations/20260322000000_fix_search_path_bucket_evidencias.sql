-- Fix: pin search_path on bucket_evidencias_id() to prevent schema-squatting.
-- Supabase linter flags any public function without SET search_path.
-- The empty string forces fully-qualified name resolution (safe here since the
-- function body contains only a string literal and references no schema objects).

CREATE OR REPLACE FUNCTION public.bucket_evidencias_id()
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = ''
AS $$
  SELECT 'evidencias';
$$;
