-- RPC para a criança concluir uma atribuição (pendente → aguardando_validacao).
-- Substitui o UPDATE direto do client, garantindo validação atômica server-side.
-- O upload de evidência continua no client; este RPC recebe apenas o path.

CREATE OR REPLACE FUNCTION public.concluir_atribuicao(
  p_atribuicao_id UUID,
  p_evidencia_url TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
  v_caller_id UUID;
  v_filho_id UUID;
  v_tarefa_familia UUID;
  v_exige_evidencia BOOLEAN;
BEGIN
  v_caller_id := public.usuario_autenticado_id();

  -- Busca a atribuição pendente e valida que pertence ao caller
  SELECT a.filho_id, t.familia_id, t.exige_evidencia
    INTO v_filho_id, v_tarefa_familia, v_exige_evidencia
    FROM public.atribuicoes a
    JOIN public.tarefas t ON t.id = a.tarefa_id
    JOIN public.filhos f ON f.id = a.filho_id
   WHERE a.id = p_atribuicao_id
     AND a.status = 'pendente'
     AND f.usuario_id = v_caller_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Atribuição não encontrada ou não está pendente';
  END IF;

  -- Valida que a família da tarefa é a mesma do caller
  IF v_tarefa_familia != public.minha_familia_id() THEN
    RAISE EXCEPTION 'Acesso negado: atribuição de outra família';
  END IF;

  -- Valida evidência quando a tarefa exige
  IF v_exige_evidencia AND (p_evidencia_url IS NULL OR trim(p_evidencia_url) = '') THEN
    RAISE EXCEPTION 'Esta tarefa exige evidência';
  END IF;

  UPDATE public.atribuicoes
     SET status = 'aguardando_validacao',
         evidencia_url = p_evidencia_url,
         concluida_em = now()
   WHERE id = p_atribuicao_id;
END;
$;
