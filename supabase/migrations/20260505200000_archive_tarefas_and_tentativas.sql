-- Migration: add archive flag to tarefas and submission attempt counter to atribuicoes.
-- Part of the Creative Studio task journey migration.
-- - tarefas.arquivada_em: timestamptz nullable. NULL = active, non-null = archived (hidden from
--   default lists, no recurring generation, history preserved).
-- - atribuicoes.tentativas: number of submissions made by the child for this assignment (max 2).

ALTER TABLE public.tarefas
  ADD COLUMN arquivada_em timestamptz NULL;

COMMENT ON COLUMN public.tarefas.arquivada_em IS
  'When non-null, the task is archived: hidden from default lists, no new recurring assignments are generated, history is preserved.';

CREATE INDEX idx_tarefas_familia_ativas_nao_arquivadas
  ON public.tarefas (familia_id)
  WHERE arquivada_em IS NULL;

ALTER TABLE public.atribuicoes
  ADD COLUMN tentativas integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.atribuicoes.tentativas IS
  'Number of submissions (concluir_atribuicao) made by the child. Capped at 2 in concluir_atribuicao.';

-- Backfill: assignments that were already submitted (any status other than pendente) count as
-- having had at least one submission attempt.
UPDATE public.atribuicoes
   SET tentativas = 1
 WHERE status IN ('aguardando_validacao', 'aprovada', 'rejeitada');

ALTER TABLE public.atribuicoes
  ADD CONSTRAINT atribuicoes_tentativas_max CHECK (tentativas >= 0 AND tentativas <= 2);
