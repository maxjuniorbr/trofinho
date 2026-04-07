-- M6: Add missing FK indexes
-- Without these, ON DELETE SET NULL / CASCADE triggers full table scans.

CREATE INDEX IF NOT EXISTS idx_tarefas_criado_por
  ON public.tarefas (criado_por);

CREATE INDEX IF NOT EXISTS idx_atribuicoes_validada_por
  ON public.atribuicoes (validada_por);
