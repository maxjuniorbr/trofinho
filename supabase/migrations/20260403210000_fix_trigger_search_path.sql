-- ============================================================
-- Trofinho — Fix search_path for trigger functions
-- Adds SET search_path = public to prevent function_search_path_mutable
-- security advisory warnings on set_concluida_em_on_submit and
-- prevent_usuarios_privilege_escalation.
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_concluida_em_on_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status = 'aguardando_validacao' THEN
    NEW.concluida_em = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_usuarios_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.papel != OLD.papel OR NEW.familia_id IS DISTINCT FROM OLD.familia_id THEN
    RAISE EXCEPTION 'Alteração de papel ou família não permitida.';
  END IF;
  RETURN NEW;
END;
$$;
