-- Migration 1/2: Add 'cancelada' to atribuicao_status enum.
-- This must run in its own transaction before the enum value can be used.
ALTER TYPE public.atribuicao_status ADD VALUE IF NOT EXISTS 'cancelada';
