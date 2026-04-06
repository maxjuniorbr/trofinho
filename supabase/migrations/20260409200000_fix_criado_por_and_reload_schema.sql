-- Fix tarefas.criado_por NOT NULL + ON DELETE SET NULL contradiction.
-- The account deletion RPC (excluir_minha_conta) cascades through familias,
-- so criado_por SET NULL is a safety net only; allow NULL for consistency.
ALTER TABLE public.tarefas ALTER COLUMN criado_por DROP NOT NULL;

-- Grant execute on excluir_minha_conta (missing from account_deletion migration).
GRANT EXECUTE ON FUNCTION public.excluir_minha_conta() TO authenticated;

-- Force PostgREST schema cache reload.
-- The account_deletion migration dropped and recreated tarefas_criado_por_fkey,
-- which may have staled PostgREST's FK cache, breaking the tarefas(*) join
-- used by child assignment queries.
NOTIFY pgrst, 'reload schema';
