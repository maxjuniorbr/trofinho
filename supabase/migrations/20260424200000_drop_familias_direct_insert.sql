-- Remove direct INSERT access to familias table for authenticated clients.
-- Family creation MUST go through the criar_familia RPC (SECURITY DEFINER),
-- which enforces the business invariant: one family + one admin profile atomically.
DROP POLICY "familias_insert_authenticated" ON public.familias;
