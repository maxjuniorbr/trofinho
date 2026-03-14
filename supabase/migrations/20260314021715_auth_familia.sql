-- ============================================================
-- Trofinho — Marco 2: Auth & Família
-- ============================================================

-- ─── POLICIES: INSERT em familias ───────────────────────────
-- Qualquer usuário autenticado pode criar uma família
-- (o controle fino é feito pela função criar_familia)

CREATE POLICY "familias_insert_authenticated"
  ON public.familias
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ─── POLICIES: INSERT em usuarios ───────────────────────────
-- O próprio usuário pode inserir seu registro de perfil
-- (usado na criação via trigger ou via função criar_familia)

CREATE POLICY "usuarios_insert_self"
  ON public.usuarios
  FOR INSERT
  WITH CHECK (id = auth.uid());

-- ─── FUNÇÃO: criar_familia ───────────────────────────────────
-- Cria família + perfil admin de forma atômica.
-- SECURITY DEFINER: executa como o owner da função (postgres),
-- bypassando RLS para garantir a inserção transacional segura.
-- O chamador deve estar autenticado (auth.uid() deve ser não-nulo).

CREATE OR REPLACE FUNCTION public.criar_familia(
  nome_familia TEXT,
  nome_usuario TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    UUID;
  v_familia_id UUID;
BEGIN
  -- Garante que há um usuário autenticado
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Impede que o usuário crie múltiplas famílias
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Usuário já pertence a uma família';
  END IF;

  -- Cria a família
  INSERT INTO public.familias (nome)
  VALUES (nome_familia)
  RETURNING id INTO v_familia_id;

  -- Cria o perfil admin
  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (v_user_id, v_familia_id, 'admin', nome_usuario);

  RETURN v_familia_id;
END;
$$;
