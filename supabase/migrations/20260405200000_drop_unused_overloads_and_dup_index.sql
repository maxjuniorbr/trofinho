-- Drop unused single-argument upsert_push_token overload.
-- Only the two-argument version (p_token, p_device_id) is called by the app.
DROP FUNCTION IF EXISTS public.upsert_push_token(text);

-- Drop unused timebox overload of criar_tarefa_com_atribuicoes.
-- Only the frequency-based version is called. The timebox version also has a bug:
-- it omits pontos_snapshot which is NOT NULL on atribuicoes.
DROP FUNCTION IF EXISTS public.criar_tarefa_com_atribuicoes(text, text, integer, date, date, boolean, uuid[]);

-- Drop duplicate index on filhos.usuario_id.
-- idx_filhos_usuario_id already covers the same column.
DROP INDEX IF EXISTS public.idx_filhos_usuario;
