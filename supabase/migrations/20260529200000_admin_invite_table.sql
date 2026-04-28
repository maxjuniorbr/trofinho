-- Admin invite table: convites_admin
-- Stores invite records for co-admin onboarding via short alphanumeric codes.
-- Requirements: 8.1, 8.2, 8.3, 8.4

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.convites_admin (
  id            uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  familia_id    uuid        NOT NULL REFERENCES public.familias(id) ON DELETE CASCADE,
  convidado_por uuid        NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  codigo        text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pendente',
  aceito_por    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,

  CONSTRAINT convites_admin_status_check
    CHECK (status IN ('pendente', 'aceito', 'expirado', 'cancelado')),

  CONSTRAINT convites_admin_codigo_length
    CHECK (length(codigo) = 6)
);

-- 2. Partial unique index: only one pending invite per code
CREATE UNIQUE INDEX idx_convites_admin_codigo_pendente
  ON public.convites_admin (codigo)
  WHERE status = 'pendente';

-- 3. Partial index: fast lookup of pending invite per family
CREATE INDEX idx_convites_admin_familia_pendente
  ON public.convites_admin (familia_id)
  WHERE status = 'pendente';

-- 4. RLS
ALTER TABLE public.convites_admin ENABLE ROW LEVEL SECURITY;

CREATE POLICY admins_read_own_family_invites
  ON public.convites_admin FOR SELECT
  USING (
    familia_id = public.minha_familia_id()
    AND public.usuario_e_admin()
  );

-- 5. Grants (same pattern as other tables)
GRANT ALL ON TABLE public.convites_admin TO anon, authenticated, service_role;

-- 6. Helper function: generate secure alphanumeric invite code
-- Uses cryptographic randomness (gen_random_bytes) with a reduced alphabet
-- that excludes ambiguous characters (O, 0, I, 1, L).
-- 31^6 ≈ 887 million possible combinations.
-- Requirements: 1.1, 9.1, 9.3
CREATE OR REPLACE FUNCTION public.gerar_codigo_convite() RETURNS text AS $$
DECLARE
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_i integer;
  v_bytes bytea;
BEGIN
  v_bytes := gen_random_bytes(6);
  FOR v_i IN 0..5 LOOP
    v_code := v_code || substr(v_chars, (get_byte(v_bytes, v_i) % 31) + 1, 1);
  END LOOP;
  RETURN v_code;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 7. RPC: gerar_convite_admin
-- Generates an admin invite code for the caller's family.
-- Validates: caller is admin, family has < 2 admins, no pending invite exists.
-- Generates a unique 6-char code (retries on collision), inserts with 48h expiry.
-- Requirements: 1.1, 1.3, 1.4, 2.1, 2.2, 2.3
CREATE OR REPLACE FUNCTION public.gerar_convite_admin()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id  uuid;
  v_caller_id   uuid;
  v_admin_count integer;
  v_codigo      text;
  v_convite_id  uuid;
  v_expires_at  timestamptz;
BEGIN
  -- Ensure authenticated user
  v_caller_id := public.usuario_autenticado_id();

  -- Only admins can generate invites
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem gerar convites';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- Check max 2 admins per family
  SELECT count(*) INTO v_admin_count
    FROM public.usuarios
   WHERE familia_id = v_familia_id
     AND papel = 'admin';

  IF v_admin_count >= 2 THEN
    RAISE EXCEPTION 'Esta família já possui o número máximo de administradores';
  END IF;

  -- Check no pending invite exists for this family
  IF EXISTS (
    SELECT 1 FROM public.convites_admin
     WHERE familia_id = v_familia_id
       AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Já existe um convite pendente para esta família';
  END IF;

  -- Generate unique code in a loop (retry on unique index violation)
  LOOP
    v_codigo := public.gerar_codigo_convite();

    BEGIN
      v_expires_at := now() + interval '48 hours';

      INSERT INTO public.convites_admin (familia_id, convidado_por, codigo, status, expires_at)
      VALUES (v_familia_id, v_caller_id, v_codigo, 'pendente', v_expires_at)
      RETURNING id INTO v_convite_id;

      -- Insert succeeded, exit loop
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- Code already exists as pending, retry with a new code
        NULL;
    END;
  END LOOP;

  -- Audit log
  PERFORM public.registrar_audit(
    'gerar_convite_admin', 'convite_admin', v_convite_id,
    jsonb_build_object('codigo', v_codigo, 'familia_id', v_familia_id)
  );

  RETURN json_build_object(
    'codigo', v_codigo,
    'expires_at', v_expires_at
  );
END;
$$;

GRANT ALL ON FUNCTION public.gerar_convite_admin() TO anon, authenticated, service_role;

-- 8. RPC: validar_convite_admin
-- Validates an invite code and returns family/admin preview info.
-- Read-only function: does not modify any data.
-- Requirements: 3.3, 3.5, 4.2
CREATE OR REPLACE FUNCTION public.validar_convite_admin(p_codigo text)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_convite    record;
BEGIN
  -- Look up a pending invite matching the code (case-insensitive via upper)
  SELECT
    ca.id,
    ca.expires_at,
    f.nome   AS familia_nome,
    u.nome   AS admin_nome
  INTO v_convite
  FROM public.convites_admin ca
  JOIN public.familias f ON f.id = ca.familia_id
  JOIN public.usuarios u ON u.id = ca.convidado_por
  WHERE ca.codigo = upper(p_codigo)
    AND ca.status = 'pendente';

  -- No pending invite found at all for this code
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código inválido ou expirado. Verifique o código e tente novamente';
  END IF;

  -- Found a pending invite but it has expired
  IF v_convite.expires_at <= now() THEN
    RAISE EXCEPTION 'Este convite expirou. Solicite um novo código ao administrador';
  END IF;

  -- Valid invite: return family and admin names
  RETURN json_build_object(
    'familia_nome', v_convite.familia_nome,
    'admin_nome',   v_convite.admin_nome
  );
END;
$$;

GRANT ALL ON FUNCTION public.validar_convite_admin(text) TO anon, authenticated, service_role;

-- 9. Rate limit tracking table for invite attempts.
-- Cannot use verificar_limite_frequencia() because it queries movimentacoes
-- (child financial transactions by filho_id). Cannot use audit_log because
-- familia_id is NOT NULL with FK to familias, and the accepting user has no
-- family yet. This lightweight table tracks attempts per user for rate limiting.
CREATE TABLE IF NOT EXISTS public.tentativas_convite (
  id         uuid        DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
  user_id    uuid        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tentativas_convite_rate_limit
  ON public.tentativas_convite (user_id, created_at);

ALTER TABLE public.tentativas_convite ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.tentativas_convite TO anon, authenticated, service_role;

-- 10. RPC: aceitar_convite_admin
-- Accepts a pending invite: creates a new admin user record and marks the invite as accepted.
-- Validates: rate limit, invite exists and not expired, user has no family, family < 2 admins.
-- Requirements: 3.4, 3.5, 3.6, 4.1, 4.2, 9.2
CREATE OR REPLACE FUNCTION public.aceitar_convite_admin(p_codigo text, p_nome text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id     uuid;
  v_convite     record;
  v_admin_count integer;
  v_tentativas  integer;
BEGIN
  -- Ensure authenticated user
  v_user_id := public.usuario_autenticado_id();

  -- Rate limit: max 5 attempts per 10 minutes.
  -- Uses dedicated tentativas_convite table because:
  -- - verificar_limite_frequencia() queries movimentacoes (child transactions)
  -- - audit_log requires familia_id FK, but the user has no family yet
  SELECT count(*)::int INTO v_tentativas
    FROM public.tentativas_convite
   WHERE user_id = v_user_id
     AND created_at > now() - interval '10 minutes';

  IF v_tentativas >= 5 THEN
    RAISE EXCEPTION 'Muitas tentativas incorretas. Aguarde alguns minutos e tente novamente';
  END IF;

  -- Record this attempt for rate limiting (before any validation)
  INSERT INTO public.tentativas_convite (user_id) VALUES (v_user_id);

  -- Look up pending, non-expired invite
  SELECT ca.id, ca.familia_id, ca.expires_at
    INTO v_convite
    FROM public.convites_admin ca
   WHERE ca.codigo = upper(p_codigo)
     AND ca.status = 'pendente'
     AND ca.expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código inválido ou expirado. Verifique o código e tente novamente';
  END IF;

  -- Validate user does not already belong to a family
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id = v_user_id) THEN
    RAISE EXCEPTION 'Você já pertence a uma família';
  END IF;

  -- Validate family has < 2 admins
  SELECT count(*)::int INTO v_admin_count
    FROM public.usuarios
   WHERE familia_id = v_convite.familia_id
     AND papel = 'admin';

  IF v_admin_count >= 2 THEN
    RAISE EXCEPTION 'Esta família já possui o número máximo de administradores';
  END IF;

  -- Insert new admin user record
  INSERT INTO public.usuarios (id, familia_id, papel, nome)
  VALUES (v_user_id, v_convite.familia_id, 'admin', p_nome);

  -- Update invite status to accepted
  UPDATE public.convites_admin
     SET status = 'aceito',
         aceito_por = v_user_id
   WHERE id = v_convite.id;

  -- Audit log (now minha_familia_id() works because the user was just inserted)
  PERFORM public.registrar_audit(
    'aceitar_convite_admin', 'convite_admin', v_convite.id,
    jsonb_build_object('familia_id', v_convite.familia_id, 'codigo', upper(p_codigo))
  );

  RETURN v_convite.familia_id;
END;
$$;

GRANT ALL ON FUNCTION public.aceitar_convite_admin(text, text) TO anon, authenticated, service_role;

-- 11. RPC: cancelar_convite_admin
-- Cancels a pending admin invite. Only the admin of the same family can cancel.
-- Updates status to 'cancelado' and registers an audit log entry.
-- Requirements: 4.3
CREATE OR REPLACE FUNCTION public.cancelar_convite_admin(p_convite_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_convite record;
BEGIN
  -- Only admins can cancel invites
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem cancelar convites';
  END IF;

  -- Look up the invite: must belong to caller's family and be pending
  SELECT id, familia_id
    INTO v_convite
    FROM public.convites_admin
   WHERE id = p_convite_id
     AND familia_id = public.minha_familia_id()
     AND status = 'pendente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Convite não encontrado ou não está pendente';
  END IF;

  -- Update status to cancelled
  UPDATE public.convites_admin
     SET status = 'cancelado'
   WHERE id = v_convite.id;

  -- Audit log
  PERFORM public.registrar_audit(
    'cancelar_convite_admin', 'convite_admin', v_convite.id,
    jsonb_build_object('familia_id', v_convite.familia_id)
  );
END;
$$;

GRANT ALL ON FUNCTION public.cancelar_convite_admin(uuid) TO anon, authenticated, service_role;

-- 12. RPC: remover_co_admin
-- Removes a co-admin from the caller's family by deleting their usuarios record.
-- The auth.users record is preserved so the user can create/join another family.
-- Validates: caller is admin of same family, target is admin, target is not self,
-- family has > 1 admin (cannot remove the only admin).
-- Requirements: 7.1, 7.2, 7.3
CREATE OR REPLACE FUNCTION public.remover_co_admin(p_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id    uuid;
  v_familia_id   uuid;
  v_target       record;
  v_admin_count  integer;
BEGIN
  -- Ensure authenticated user
  v_caller_id := public.usuario_autenticado_id();

  -- Only admins can remove co-admins
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem remover co-administradores';
  END IF;

  v_familia_id := public.minha_familia_id();

  -- Cannot remove yourself
  IF p_usuario_id = v_caller_id THEN
    RAISE EXCEPTION 'Não é possível remover a si mesmo';
  END IF;

  -- Verify target user belongs to the same family and is an admin
  SELECT id, familia_id, papel
    INTO v_target
    FROM public.usuarios
   WHERE id = p_usuario_id
     AND familia_id = v_familia_id
     AND papel = 'admin';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Administrador não encontrado nesta família';
  END IF;

  -- Count admins in the family — must be > 1
  SELECT count(*)::int INTO v_admin_count
    FROM public.usuarios
   WHERE familia_id = v_familia_id
     AND papel = 'admin';

  IF v_admin_count <= 1 THEN
    RAISE EXCEPTION 'Não é possível remover o único administrador da família';
  END IF;

  -- Remove the co-admin's usuarios record (auth.users is preserved)
  DELETE FROM public.usuarios WHERE id = p_usuario_id;

  -- Audit log
  PERFORM public.registrar_audit(
    'remover_co_admin', 'usuario', p_usuario_id,
    jsonb_build_object('familia_id', v_familia_id)
  );
END;
$$;

GRANT ALL ON FUNCTION public.remover_co_admin(uuid) TO anon, authenticated, service_role;

-- 13. RPC: listar_admins_familia
-- Returns the list of admins in the caller's family with id, nome, and email.
-- Joins with auth.users to retrieve the email address.
-- Requirements: 5.1, 6.1
CREATE OR REPLACE FUNCTION public.listar_admins_familia()
RETURNS json[]
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_familia_id uuid;
  v_result     json[];
BEGIN
  -- Only admins can list family admins
  IF NOT public.usuario_e_admin() THEN
    RAISE EXCEPTION 'Apenas admins podem listar administradores';
  END IF;

  v_familia_id := public.minha_familia_id();

  SELECT coalesce(array_agg(
    json_build_object(
      'id',    u.id,
      'nome',  u.nome,
      'email', au.email
    )
  ), ARRAY[]::json[])
  INTO v_result
  FROM public.usuarios u
  JOIN auth.users au ON au.id = u.id
  WHERE u.familia_id = v_familia_id
    AND u.papel = 'admin';

  RETURN v_result;
END;
$$;

GRANT ALL ON FUNCTION public.listar_admins_familia() TO anon, authenticated, service_role;
