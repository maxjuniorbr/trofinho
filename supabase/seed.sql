-- Seed para desenvolvimento local
-- Popula o banco com dados representativos ao rodar `supabase db reset`
--
-- IMPORTANTE: Este seed assume que os auth users já foram criados via
-- Supabase Dashboard ou supabase auth admin. Os UUIDs abaixo são fixos
-- para facilitar referências cruzadas durante desenvolvimento.
--
-- Para usar: crie os auth users no Dashboard com os mesmos UUIDs e emails,
-- depois rode `supabase db reset` para popular as tabelas de negócio.

-- ─── Famílias ────────────────────────────────────────────────────────────────

INSERT INTO familias (id, nome, created_at) VALUES
  ('fam-silva-0001-0001-000000000001', 'Família Silva', '2026-01-15T10:00:00Z'),
  ('fam-costa-0002-0002-000000000002', 'Família Costa', '2026-02-01T14:00:00Z');

-- ─── Usuários (admin = pai/mãe, filho = criança) ────────────────────────────

-- Família Silva: 1 admin + 2 filhos
INSERT INTO usuarios (id, familia_id, nome, papel, created_at) VALUES
  ('usr-silva-adm1-0001-000000000001', 'fam-silva-0001-0001-000000000001', 'Carlos Silva', 'admin', '2026-01-15T10:00:00Z'),
  ('usr-silva-kid1-0001-000000000002', 'fam-silva-0001-0001-000000000001', 'Lia Silva', 'filho', '2026-01-15T10:05:00Z'),
  ('usr-silva-kid2-0001-000000000003', 'fam-silva-0001-0001-000000000001', 'Leo Silva', 'filho', '2026-01-15T10:10:00Z');

-- Família Costa: 1 admin + 1 filho
INSERT INTO usuarios (id, familia_id, nome, papel, created_at) VALUES
  ('usr-costa-adm1-0002-000000000001', 'fam-costa-0002-0002-000000000002', 'Ana Costa', 'admin', '2026-02-01T14:00:00Z'),
  ('usr-costa-kid1-0002-000000000002', 'fam-costa-0002-0002-000000000002', 'Beto Costa', 'filho', '2026-02-01T14:05:00Z');

-- ─── Filhos ──────────────────────────────────────────────────────────────────

INSERT INTO filhos (id, familia_id, nome, usuario_id, created_at) VALUES
  ('fil-silva-lia0-0001-000000000001', 'fam-silva-0001-0001-000000000001', 'Lia Silva', 'usr-silva-kid1-0001-000000000002', '2026-01-15T10:05:00Z'),
  ('fil-silva-leo0-0001-000000000002', 'fam-silva-0001-0001-000000000001', 'Leo Silva', 'usr-silva-kid2-0001-000000000003', '2026-01-15T10:10:00Z'),
  ('fil-costa-beto-0002-000000000001', 'fam-costa-0002-0002-000000000002', 'Beto Costa', 'usr-costa-kid1-0002-000000000002', '2026-02-01T14:05:00Z');

-- ─── Tarefas ─────────────────────────────────────────────────────────────────

INSERT INTO tarefas (id, familia_id, titulo, descricao, pontos, frequencia, exige_evidencia, criado_por, created_at) VALUES
  -- Família Silva: tarefas variadas
  ('tar-silva-0001-0001-000000000001', 'fam-silva-0001-0001-000000000001', 'Arrumar a cama', 'Arrumar a cama todos os dias antes de sair.', 5, 'diaria', false, 'usr-silva-adm1-0001-000000000001', '2026-01-16T08:00:00Z'),
  ('tar-silva-0002-0001-000000000002', 'fam-silva-0001-0001-000000000001', 'Lavar a louça', NULL, 10, 'diaria', false, 'usr-silva-adm1-0001-000000000001', '2026-01-16T08:05:00Z'),
  ('tar-silva-0003-0001-000000000003', 'fam-silva-0001-0001-000000000001', 'Ler 30 minutos', 'Ler qualquer livro por pelo menos 30 minutos.', 15, 'diaria', false, 'usr-silva-adm1-0001-000000000001', '2026-01-17T09:00:00Z'),
  ('tar-silva-0004-0001-000000000004', 'fam-silva-0001-0001-000000000001', 'Organizar o quarto', 'Organizar brinquedos e roupas no armário.', 20, 'unica', true, 'usr-silva-adm1-0001-000000000001', '2026-01-20T10:00:00Z'),
  -- Família Costa
  ('tar-costa-0001-0002-000000000001', 'fam-costa-0002-0002-000000000002', 'Estudar matemática', 'Resolver 10 exercícios do caderno.', 15, 'diaria', false, 'usr-costa-adm1-0002-000000000001', '2026-02-02T08:00:00Z'),
  ('tar-costa-0002-0002-000000000002', 'fam-costa-0002-0002-000000000002', 'Limpar o quarto', NULL, 25, 'unica', true, 'usr-costa-adm1-0002-000000000001', '2026-02-03T09:00:00Z');

-- ─── Atribuições (vários status) ─────────────────────────────────────────────

INSERT INTO atribuicoes (id, tarefa_id, filho_id, status, pontos_snapshot, evidencia_url, nota_rejeicao, concluida_em, validada_em, validada_por, created_at, competencia) VALUES
  -- Lia: cama aprovada, louça pendente, leitura aguardando validação
  ('atr-0001-0001-0001-000000000001', 'tar-silva-0001-0001-000000000001', 'fil-silva-lia0-0001-000000000001', 'aprovada', 5, NULL, NULL, '2026-03-25T07:30:00Z', '2026-03-25T08:00:00Z', 'usr-silva-adm1-0001-000000000001', '2026-03-25T06:00:00Z', '2026-03-25'),
  ('atr-0002-0001-0001-000000000002', 'tar-silva-0002-0001-000000000002', 'fil-silva-lia0-0001-000000000001', 'pendente', 10, NULL, NULL, NULL, NULL, NULL, '2026-03-28T06:00:00Z', '2026-03-28'),
  ('atr-0003-0001-0001-000000000003', 'tar-silva-0003-0001-000000000003', 'fil-silva-lia0-0001-000000000001', 'aguardando_validacao', 15, NULL, NULL, '2026-03-27T18:00:00Z', NULL, NULL, '2026-03-27T06:00:00Z', '2026-03-27'),
  -- Lia: quarto rejeitada (tarefa única com evidência)
  ('atr-0004-0001-0001-000000000004', 'tar-silva-0004-0001-000000000004', 'fil-silva-lia0-0001-000000000001', 'rejeitada', 20, NULL, 'Faltou organizar o armário.', '2026-01-21T15:00:00Z', '2026-01-21T18:00:00Z', 'usr-silva-adm1-0001-000000000001', '2026-01-20T10:00:00Z', NULL),
  -- Leo: cama pendente, louça aprovada
  ('atr-0005-0001-0002-000000000001', 'tar-silva-0001-0001-000000000001', 'fil-silva-leo0-0001-000000000002', 'pendente', 5, NULL, NULL, NULL, NULL, NULL, '2026-03-28T06:00:00Z', '2026-03-28'),
  ('atr-0006-0001-0002-000000000002', 'tar-silva-0002-0001-000000000002', 'fil-silva-leo0-0001-000000000002', 'aprovada', 10, NULL, NULL, '2026-03-26T12:00:00Z', '2026-03-26T14:00:00Z', 'usr-silva-adm1-0001-000000000001', '2026-03-26T06:00:00Z', '2026-03-26'),
  -- Beto: matemática aprovada, quarto aguardando
  ('atr-0007-0002-0001-000000000001', 'tar-costa-0001-0002-000000000001', 'fil-costa-beto-0002-000000000001', 'aprovada', 15, NULL, NULL, '2026-03-25T16:00:00Z', '2026-03-25T18:00:00Z', 'usr-costa-adm1-0002-000000000001', '2026-03-25T06:00:00Z', '2026-03-25'),
  ('atr-0008-0002-0001-000000000002', 'tar-costa-0002-0002-000000000002', 'fil-costa-beto-0002-000000000001', 'aguardando_validacao', 25, NULL, NULL, '2026-03-27T14:00:00Z', NULL, NULL, '2026-03-03T09:00:00Z', NULL);

-- ─── Prêmios ─────────────────────────────────────────────────────────────────

INSERT INTO premios (id, familia_id, nome, descricao, custo_pontos, imagem_url, ativo, created_at) VALUES
  -- Família Silva: ativos e inativos
  ('pre-silva-0001-0001-000000000001', 'fam-silva-0001-0001-000000000001', 'Sorvete', 'Uma bola de sorvete do sabor favorito.', 30, NULL, true, '2026-01-16T12:00:00Z'),
  ('pre-silva-0002-0001-000000000002', 'fam-silva-0001-0001-000000000001', 'Cinema', 'Sessão de cinema no shopping.', 100, NULL, true, '2026-01-16T12:05:00Z'),
  ('pre-silva-0003-0001-000000000003', 'fam-silva-0001-0001-000000000001', '30 min de videogame', NULL, 15, NULL, true, '2026-01-17T10:00:00Z'),
  ('pre-silva-0004-0001-000000000004', 'fam-silva-0001-0001-000000000001', 'Brinquedo antigo', 'Prêmio descontinuado.', 200, NULL, false, '2026-01-18T10:00:00Z'),
  -- Família Costa
  ('pre-costa-0001-0002-000000000001', 'fam-costa-0002-0002-000000000002', 'Livro novo', 'Escolher um livro na livraria.', 50, NULL, true, '2026-02-02T12:00:00Z'),
  ('pre-costa-0002-0002-000000000002', 'fam-costa-0002-0002-000000000002', 'Passeio no parque', NULL, 40, NULL, true, '2026-02-02T12:05:00Z');

-- ─── Resgates (vários status) ────────────────────────────────────────────────

INSERT INTO resgates (id, filho_id, premio_id, status, pontos_debitados, created_at, updated_at) VALUES
  -- Lia: sorvete confirmado, cinema pendente
  ('res-0001-0001-0001-000000000001', 'fil-silva-lia0-0001-000000000001', 'pre-silva-0001-0001-000000000001', 'confirmado', 30, '2026-03-20T15:00:00Z', '2026-03-20T18:00:00Z'),
  ('res-0002-0001-0001-000000000002', 'fil-silva-lia0-0001-000000000001', 'pre-silva-0002-0001-000000000002', 'pendente', 100, '2026-03-27T10:00:00Z', '2026-03-27T10:00:00Z'),
  -- Leo: videogame cancelado
  ('res-0003-0001-0002-000000000001', 'fil-silva-leo0-0001-000000000002', 'pre-silva-0003-0001-000000000003', 'cancelado', 15, '2026-03-22T09:00:00Z', '2026-03-22T12:00:00Z'),
  -- Beto: livro pendente
  ('res-0004-0002-0001-000000000001', 'fil-costa-beto-0002-000000000001', 'pre-costa-0001-0002-000000000001', 'pendente', 50, '2026-03-26T16:00:00Z', '2026-03-26T16:00:00Z');

-- ─── Movimentações de pontos ─────────────────────────────────────────────────

INSERT INTO movimentacoes (id, filho_id, tipo, valor, descricao, referencia_id, created_at) VALUES
  -- Lia: créditos de tarefas aprovadas + débito de resgate
  ('mov-0001-0001-0001-000000000001', 'fil-silva-lia0-0001-000000000001', 'tarefa', 5, 'Arrumar a cama', 'atr-0001-0001-0001-000000000001', '2026-03-25T08:00:00Z'),
  ('mov-0002-0001-0001-000000000002', 'fil-silva-lia0-0001-000000000001', 'resgate', -30, 'Sorvete', 'res-0001-0001-0001-000000000001', '2026-03-20T18:00:00Z'),
  ('mov-0003-0001-0001-000000000003', 'fil-silva-lia0-0001-000000000001', 'resgate', -100, 'Cinema', 'res-0002-0001-0001-000000000002', '2026-03-27T10:00:00Z'),
  -- Leo: crédito de tarefa + resgate cancelado (estorno)
  ('mov-0004-0001-0002-000000000001', 'fil-silva-leo0-0001-000000000002', 'tarefa', 10, 'Lavar a louça', 'atr-0006-0001-0002-000000000002', '2026-03-26T14:00:00Z'),
  ('mov-0005-0001-0002-000000000002', 'fil-silva-leo0-0001-000000000002', 'resgate', -15, '30 min de videogame', 'res-0003-0001-0002-000000000001', '2026-03-22T09:00:00Z'),
  ('mov-0006-0001-0002-000000000003', 'fil-silva-leo0-0001-000000000002', 'estorno', 15, 'Estorno: 30 min de videogame', 'res-0003-0001-0002-000000000001', '2026-03-22T12:00:00Z'),
  -- Beto: crédito + resgate pendente
  ('mov-0007-0002-0001-000000000001', 'fil-costa-beto-0002-000000000001', 'tarefa', 15, 'Estudar matemática', 'atr-0007-0002-0001-000000000001', '2026-03-25T18:00:00Z'),
  ('mov-0008-0002-0001-000000000002', 'fil-costa-beto-0002-000000000001', 'resgate', -50, 'Livro novo', 'res-0004-0002-0001-000000000001', '2026-03-26T16:00:00Z');
