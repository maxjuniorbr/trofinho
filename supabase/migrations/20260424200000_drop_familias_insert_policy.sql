-- Drop the direct INSERT policy on familias that allows any authenticated user
-- to create family rows bypassing the criar_familia RPC and its invariants.
-- All family creation must go through the criar_familia RPC (SECURITY DEFINER),
-- which atomically creates the family and the admin user profile.
DROP POLICY IF EXISTS "familias_insert_authenticated" ON public.familias;
