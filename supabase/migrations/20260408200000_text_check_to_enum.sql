-- Q2.1 + Q2.2 + Q2.3: Convert TEXT+CHECK columns to ENUM types
-- Aligns resgates.status, movimentacoes.tipo, usuarios.papel
-- with the existing ENUM pattern (atribuicao_status, periodo_valorizacao, tarefa_frequencia).

-- 1. Create ENUM types
CREATE TYPE public.resgate_status AS ENUM ('pendente', 'confirmado', 'cancelado');

CREATE TYPE public.movimentacao_tipo AS ENUM (
  'credito', 'debito', 'transferencia_cofrinho',
  'valorizacao', 'penalizacao', 'resgate', 'estorno_resgate'
);

CREATE TYPE public.usuario_papel AS ENUM ('admin', 'filho');

-- 2. Drop CHECK constraints
ALTER TABLE public.resgates DROP CONSTRAINT resgates_status_check;
ALTER TABLE public.movimentacoes DROP CONSTRAINT movimentacoes_tipo_check;
ALTER TABLE public.usuarios DROP CONSTRAINT usuarios_papel_check;

-- 3. Drop incompatible default before type change
ALTER TABLE public.resgates ALTER COLUMN status DROP DEFAULT;

-- 4. Convert columns to ENUM types
ALTER TABLE public.resgates
  ALTER COLUMN status TYPE public.resgate_status USING status::public.resgate_status;

ALTER TABLE public.movimentacoes
  ALTER COLUMN tipo TYPE public.movimentacao_tipo USING tipo::public.movimentacao_tipo;

ALTER TABLE public.usuarios
  ALTER COLUMN papel TYPE public.usuario_papel USING papel::public.usuario_papel;

-- 5. Restore default on resgates.status
ALTER TABLE public.resgates
  ALTER COLUMN status SET DEFAULT 'pendente'::public.resgate_status;
