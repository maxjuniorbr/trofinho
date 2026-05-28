// Contract test for the Child_Task_Reminder eligibility predicate.
//
// Spec: .kiro/specs/child-task-reminder/{requirements.md,design.md,tasks.md}
//
// Task 1.5 — Property test for `selecionar_lembretes_pendentes` eligibility set
// Property 2: Eligibility predicate is exactly the spec
// Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 8.1, 8.2
//
// Strategy
// --------
// Every fast-check iteration:
//   1. opens a transaction (`BEGIN`),
//   2. seeds randomized rows across `familias`, `auth.users`, `usuarios`,
//      `filhos`, `tarefas`, `atribuicoes`, `push_tokens`, `lembretes_envios`,
//      designed to cover every rejection path of the SQL predicate,
//   3. invokes `public.selecionar_lembretes_pendentes(p_dia)` against the
//      real RPC,
//   4. computes the expected eligibility set in TypeScript as a literal
//      transcription of the predicate documented in the migration,
//   5. asserts the RPC result equals the model output (set semantics),
//   6. rolls the transaction back.
//
// The Reminder_Day used by every iteration is fixed at `2099-12-31`. No
// production row in `atribuicoes.competencia` or `lembretes_envios.dia`
// is expected to match that date, so the predicate's input space is
// effectively scoped to the seeded rows for this test alone.
//
// The test is skipped when `SUPABASE_DB_URL` is not configured. Local
// runs require a direct, transaction-capable Postgres connection string
// (Supabase "Direct connection" — NOT the pgBouncer pooler). See
// `.env.example` for the variable description and `tests/contract/README.md`
// is intentionally omitted to avoid documenting the cloud DB requirement
// twice.
//
// PII discipline (per `observability` rule + Requirements 6.x): no
// real-looking child names, task titles, or emails appear in the seed.
// Generated values are obviously synthetic (`Test Family <n>`, `task <n>`,
// `test-<uuid>@example.invalid`).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Client } from 'pg';

// ─── Connection bootstrap ────────────────────────────────────────────────────

const DB_URL = process.env.SUPABASE_DB_URL;

// Use a date so far in the future that the production DB cannot have
// `atribuicoes.competencia` or `lembretes_envios.dia` equal to it. Every
// iteration scopes its seeded data to this single Reminder_Day.
const P_DIA = '2099-12-31';

// Keep iterations small enough to fit a 200-run property in a few minutes
// over a remote connection, while still exercising every rejection path
// at least a few times across the run.
const NUM_RUNS = 200;
const MAX_FAMILIES = 2;
const MAX_USUARIOS_PER_FAMILY = 3; // includes the seed admin
const MAX_TAREFAS_PER_FAMILY = 2;
const MAX_ATRIBUICOES_PER_CHILD_TASK = 3;
const MAX_PUSH_TOKENS_PER_USER = 2;

// ─── Domain types (model side) ───────────────────────────────────────────────

type AtribuicaoStatus =
  | 'pendente'
  | 'aguardando_validacao'
  | 'aprovada'
  | 'rejeitada'
  | 'cancelada';

const ATRIBUICAO_STATUSES: readonly AtribuicaoStatus[] = [
  'pendente',
  'aguardando_validacao',
  'aprovada',
  'rejeitada',
  'cancelada',
] as const;

interface SeedFamilia {
  id: string;
  nome: string;
}

interface SeedUsuario {
  id: string;
  email: string;
  familiaId: string;
  papel: 'admin' | 'filho';
  nome: string;
  /**
   * `null` => omit the key from notif_prefs entirely (predicate must
   *           treat the missing key as `true`).
   * `true|false` => set `tarefasPendentes` to that value.
   */
  tarefasPendentesPref: boolean | null;
  pushTokens: string[];
}

interface SeedFilho {
  id: string;
  familiaId: string;
  /**
   * May be `null` to model an admin-created child placeholder that has
   * not yet completed the OAuth invite link. Such children must never
   * appear in the eligibility set because the predicate joins
   * `filhos.usuario_id` with `usuarios.id`.
   */
  usuarioId: string | null;
  nome: string;
  ativo: boolean;
}

interface SeedTarefa {
  id: string;
  familiaId: string;
  titulo: string;
  pontos: number;
  diasSemana: number;
  ativo: boolean;
  arquivadaEm: Date | null;
  excluidaEm: Date | null;
  criadoPor: string; // usuario_id (must be admin in same family)
}

interface SeedAtribuicao {
  id: string;
  tarefaId: string;
  filhoId: string;
  status: AtribuicaoStatus;
  /** May be `null` to model historical rows missing competencia. */
  competencia: string | null;
  pontosSnapshot: number;
}

interface SeedLembrete {
  filhoId: string;
  familiaId: string;
  dia: string;
  jitterSeconds: number;
  pendingCount: number;
}

interface Seed {
  familias: SeedFamilia[];
  usuarios: SeedUsuario[];
  filhos: SeedFilho[];
  tarefas: SeedTarefa[];
  atribuicoes: SeedAtribuicao[];
  lembretes: SeedLembrete[];
}

interface ExpectedRow {
  familia_id: string;
  filho_id: string;
  usuario_id: string;
  pending_count: number;
}

// ─── fast-check arbitraries ──────────────────────────────────────────────────

const uuidArb = fc.uuid({ version: 4 });

/**
 * Picks the Reminder_Day with high probability so most generated
 * atribuicoes land on `P_DIA`, exercising the positive path. Other days
 * (and `null` for legacy rows without `competencia`) are sampled less
 * frequently so the predicate's date filter is also tested.
 */
const competenciaArb = fc.oneof(
  { weight: 6, arbitrary: fc.constant(P_DIA) },
  { weight: 1, arbitrary: fc.constant('2099-12-30') },
  { weight: 1, arbitrary: fc.constant('2099-12-29') },
  { weight: 1, arbitrary: fc.constant('2098-01-15') },
  { weight: 1, arbitrary: fc.constant(null) },
);

/**
 * Generates a single complete world. `tagArb` is included so the
 * generated UUIDs and names are unique across iterations even though
 * `BEGIN/ROLLBACK` already isolates them — this keeps debugging output
 * easier to read when `fc` shrinks a counter-example.
 */
function makeSeedArb(): fc.Arbitrary<Seed> {
  return fc
    .record({
      tag: fc.string({ minLength: 4, maxLength: 6, unit: 'grapheme-ascii' }),
      numFamilias: fc.integer({ min: 1, max: MAX_FAMILIES }),
      perFamilyNumUsuarios: fc.array(
        fc.integer({ min: 1, max: MAX_USUARIOS_PER_FAMILY }),
        { minLength: MAX_FAMILIES, maxLength: MAX_FAMILIES },
      ),
      perFamilyNumTarefas: fc.array(
        fc.integer({ min: 0, max: MAX_TAREFAS_PER_FAMILY }),
        { minLength: MAX_FAMILIES, maxLength: MAX_FAMILIES },
      ),
      // Up to MAX_FAMILIES * MAX_USUARIOS * MAX_TAREFAS * MAX_ATRIBUICOES
      // = 2 * 3 * 2 * 3 = 36 atribuicoes; flatten by sampling a count
      // independently per (filho, tarefa) pair below.
      atribuicaoCount: fc.array(
        fc.integer({ min: 0, max: MAX_ATRIBUICOES_PER_CHILD_TASK }),
        {
          minLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY * MAX_TAREFAS_PER_FAMILY,
          maxLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY * MAX_TAREFAS_PER_FAMILY,
        },
      ),
      atribuicaoStatuses: fc.array(
        fc.constantFrom<AtribuicaoStatus>(...ATRIBUICAO_STATUSES),
        { minLength: 64, maxLength: 64 },
      ),
      atribuicaoCompetencias: fc.array(competenciaArb, { minLength: 64, maxLength: 64 }),
      // Per-usuario push token counts: 0 to MAX. A 0 must be exercised
      // to test req 2.5.
      pushTokenCounts: fc.array(fc.integer({ min: 0, max: MAX_PUSH_TOKENS_PER_USER }), {
        minLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
      }),
      papelMix: fc.array(fc.constantFrom<'admin' | 'filho'>('admin', 'filho'), {
        minLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
      }),
      filhoAtivoMix: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
      filhoUsuarioLinkMix: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
      tarefaAtivoMix: fc.array(fc.boolean(), {
        minLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
      }),
      tarefaExcluidaMix: fc.array(fc.boolean(), {
        minLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
      }),
      tarefaArquivadaMix: fc.array(fc.boolean(), {
        minLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_TAREFAS_PER_FAMILY,
      }),
      tarefasPendentesMix: fc.array(fc.constantFrom<boolean | null>(true, false, null), {
        minLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
        maxLength: MAX_FAMILIES * MAX_USUARIOS_PER_FAMILY,
      }),
      // For each filho, optionally insert an existing lembretes_envios
      // row whose `dia` is either `P_DIA` (must exclude that filho) or
      // a different day (must NOT exclude).
      existingLembreteMix: fc.array(
        fc.constantFrom<'none' | 'pdia' | 'other'>('none', 'pdia', 'other'),
        { minLength: 8, maxLength: 8 },
      ),
    })
    .chain((cfg) =>
      fc
        .record({
          cfg: fc.constant(cfg),
          familiaIds: fc.array(uuidArb, {
            minLength: cfg.numFamilias,
            maxLength: cfg.numFamilias,
          }),
          usuarioIds: fc.array(uuidArb, {
            minLength: cfg.numFamilias * MAX_USUARIOS_PER_FAMILY,
            maxLength: cfg.numFamilias * MAX_USUARIOS_PER_FAMILY,
          }),
          filhoIds: fc.array(uuidArb, {
            minLength: cfg.numFamilias * MAX_USUARIOS_PER_FAMILY,
            maxLength: cfg.numFamilias * MAX_USUARIOS_PER_FAMILY,
          }),
          tarefaIds: fc.array(uuidArb, {
            minLength: cfg.numFamilias * MAX_TAREFAS_PER_FAMILY,
            maxLength: cfg.numFamilias * MAX_TAREFAS_PER_FAMILY,
          }),
          atribuicaoIds: fc.array(uuidArb, { minLength: 64, maxLength: 64 }),
        })
        .map(buildSeed),
    );
}

/**
 * Materializes the random configuration into a concrete seed.
 * Constraints enforced here that fast-check cannot easily express:
 *   - Each family receives exactly one admin usuario (used as
 *     `criado_por` for tarefas — FK requires it).
 *   - `filhos` rows are only generated for usuarios with `papel='filho'`,
 *     plus an extra orphan filho per family with `usuario_id = NULL` to
 *     cover the "child without auth user yet" case.
 *   - Cross-family atribuicoes are sometimes generated (filho_A × tarefa_B
 *     where B is in another family). The migration's BEFORE INSERT trigger
 *     syncs `atribuicoes.familia_id` from the filho, so the predicate's
 *     `t.familia_id = a.familia_id` clause excludes them — this is the
 *     test for Requirement 5.3 (tenant isolation).
 */
interface SeedConfig {
  tag: string;
  numFamilias: number;
  perFamilyNumUsuarios: number[];
  perFamilyNumTarefas: number[];
  atribuicaoCount: number[];
  atribuicaoStatuses: AtribuicaoStatus[];
  atribuicaoCompetencias: (string | null)[];
  pushTokenCounts: number[];
  papelMix: ('admin' | 'filho')[];
  filhoAtivoMix: boolean[];
  filhoUsuarioLinkMix: boolean[];
  tarefaAtivoMix: boolean[];
  tarefaExcluidaMix: boolean[];
  tarefaArquivadaMix: boolean[];
  tarefasPendentesMix: (boolean | null)[];
  existingLembreteMix: ('none' | 'pdia' | 'other')[];
}

interface SeedIds {
  familiaIds: string[];
  usuarioIds: string[];
  filhoIds: string[];
  tarefaIds: string[];
  atribuicaoIds: string[];
}

function buildFamilias(cfg: SeedConfig, familiaIds: string[]): SeedFamilia[] {
  return familiaIds.map((id, i) => ({ id, nome: `Test Family ${cfg.tag}-${i}` }));
}

function buildPushTokens(cfg: SeedConfig, slot: number, count: number): string[] {
  const tokens: string[] = [];
  for (let t = 0; t < count; t++) {
    // 32+ char prefix so the value is distinguishable in logs.
    tokens.push(`ExponentPushToken[test-${cfg.tag}-${slot}-${t}-zzzzzzzzzzzz]`);
  }
  return tokens;
}

function buildOneUsuario(
  cfg: SeedConfig,
  familia: SeedFamilia,
  slot: number,
  k: number,
  id: string,
): SeedUsuario {
  // First usuario per family is always admin so tarefas have a valid
  // criado_por. Subsequent usuarios pick from the random papel mix.
  const papel: 'admin' | 'filho' = k === 0 ? 'admin' : cfg.papelMix[slot];
  return {
    id,
    email: `test-${cfg.tag}-${slot}@example.invalid`,
    familiaId: familia.id,
    papel,
    nome: `Test User ${cfg.tag}-${slot}`,
    tarefasPendentesPref: cfg.tarefasPendentesMix[slot],
    pushTokens: buildPushTokens(cfg, slot, cfg.pushTokenCounts[slot]),
  };
}

function buildFilhoForUsuario(
  cfg: SeedConfig,
  familia: SeedFamilia,
  usuario: SeedUsuario,
  slot: number,
  filhoId: string,
): SeedFilho {
  const ativo = cfg.filhoAtivoMix[slot % cfg.filhoAtivoMix.length];
  // Most filhos are linked to the usuario, but a small fraction are left
  // orphan (`usuario_id = NULL`) — the predicate must exclude those.
  const linked = cfg.filhoUsuarioLinkMix[slot % cfg.filhoUsuarioLinkMix.length];
  return {
    id: filhoId,
    familiaId: familia.id,
    usuarioId: linked ? usuario.id : null,
    nome: `Test Child ${cfg.tag}-${slot}`,
    ativo,
  };
}

function buildUsuariosAndFilhos(
  cfg: SeedConfig,
  familias: SeedFamilia[],
  usuarioIds: string[],
  filhoIds: string[],
): { usuarios: SeedUsuario[]; filhos: SeedFilho[] } {
  const usuarios: SeedUsuario[] = [];
  const filhos: SeedFilho[] = [];

  // Slot index mapping:
  //   admin usuario for family f = usuarioIds[f * MAX_USUARIOS_PER_FAMILY + 0]
  //   extra usuarios for family f = slots [f * MAX_USUARIOS_PER_FAMILY + k] for k in [1, n_f)
  for (let f = 0; f < familias.length; f++) {
    const familia = familias[f];
    const n = Math.max(1, cfg.perFamilyNumUsuarios[f]);
    for (let k = 0; k < n; k++) {
      const slot = f * MAX_USUARIOS_PER_FAMILY + k;
      const usuario = buildOneUsuario(cfg, familia, slot, k, usuarioIds[slot]);
      usuarios.push(usuario);
      if (usuario.papel === 'filho') {
        filhos.push(buildFilhoForUsuario(cfg, familia, usuario, slot, filhoIds[slot]));
      }
    }
  }
  return { usuarios, filhos };
}

function buildTarefas(
  cfg: SeedConfig,
  familias: SeedFamilia[],
  usuarios: SeedUsuario[],
  tarefaIds: string[],
): SeedTarefa[] {
  const tarefas: SeedTarefa[] = [];
  for (let f = 0; f < familias.length; f++) {
    const familia = familias[f];
    const adminId = usuarios.find((u) => u.familiaId === familia.id && u.papel === 'admin')?.id;
    if (!adminId) continue;
    const n = cfg.perFamilyNumTarefas[f];
    for (let t = 0; t < n; t++) {
      const slot = f * MAX_TAREFAS_PER_FAMILY + t;
      tarefas.push({
        id: tarefaIds[slot],
        familiaId: familia.id,
        titulo: `task ${cfg.tag}-${slot}`,
        pontos: 5,
        diasSemana: 127, // every weekday — value matters only for CHECK
        ativo: cfg.tarefaAtivoMix[slot],
        arquivadaEm: cfg.tarefaArquivadaMix[slot] ? new Date('2099-01-01T00:00:00Z') : null,
        excluidaEm: cfg.tarefaExcluidaMix[slot] ? new Date('2099-01-01T00:00:00Z') : null,
        criadoPor: adminId,
      });
    }
  }
  return tarefas;
}

function buildAtribuicoes(
  cfg: SeedConfig,
  filhos: SeedFilho[],
  tarefas: SeedTarefa[],
  atribuicaoIds: string[],
): SeedAtribuicao[] {
  const atribuicoes: SeedAtribuicao[] = [];
  let atrIdx = 0;
  let countIdx = 0;
  let statusIdx = 0;
  let compIdx = 0;
  // Cross-family pairs (filho_A × tarefa_B from another family) are
  // intentionally allowed — the predicate must filter them.
  for (const filho of filhos) {
    for (const tarefa of tarefas) {
      const n = cfg.atribuicaoCount[countIdx % cfg.atribuicaoCount.length];
      countIdx++;
      for (let k = 0; k < n; k++) {
        if (atrIdx >= atribuicaoIds.length) break;
        atribuicoes.push({
          id: atribuicaoIds[atrIdx],
          tarefaId: tarefa.id,
          filhoId: filho.id,
          status: cfg.atribuicaoStatuses[statusIdx % cfg.atribuicaoStatuses.length],
          competencia: cfg.atribuicaoCompetencias[compIdx % cfg.atribuicaoCompetencias.length],
          pontosSnapshot: tarefa.pontos,
        });
        atrIdx++;
        statusIdx++;
        compIdx++;
      }
    }
  }
  return atribuicoes;
}

function buildLembretes(cfg: SeedConfig, filhos: SeedFilho[]): SeedLembrete[] {
  const lembretes: SeedLembrete[] = [];
  for (let i = 0; i < filhos.length; i++) {
    const filho = filhos[i];
    const choice = cfg.existingLembreteMix[i % cfg.existingLembreteMix.length];
    if (choice === 'none') continue;
    lembretes.push({
      filhoId: filho.id,
      familiaId: filho.familiaId,
      dia: choice === 'pdia' ? P_DIA : '2099-12-15',
      jitterSeconds: 1234,
      pendingCount: 1,
    });
  }
  return lembretes;
}

function buildSeed(input: { cfg: SeedConfig } & SeedIds): Seed {
  const { cfg, familiaIds, usuarioIds, filhoIds, tarefaIds, atribuicaoIds } = input;
  const familias = buildFamilias(cfg, familiaIds);
  const { usuarios, filhos } = buildUsuariosAndFilhos(cfg, familias, usuarioIds, filhoIds);
  const tarefas = buildTarefas(cfg, familias, usuarios, tarefaIds);
  const atribuicoes = buildAtribuicoes(cfg, filhos, tarefas, atribuicaoIds);
  const lembretes = buildLembretes(cfg, filhos);
  return { familias, usuarios, filhos, tarefas, atribuicoes, lembretes };
}

// ─── TS model: literal transcription of the SQL predicate ────────────────────

type PendingAggregate = { familiaId: string; filhoId: string; count: number };

function isAtribuicaoTarefaEligible(tarefa: SeedTarefa, filho: SeedFilho): boolean {
  if (!tarefa.ativo) return false;
  if (tarefa.excluidaEm !== null) return false;
  if (tarefa.arquivadaEm !== null) return false;
  // The SQL predicate requires t.familia_id = a.familia_id. The
  // BEFORE INSERT trigger sets a.familia_id = filhos.familia_id, so
  // a's familia_id is the filho's familia_id. Excluding cross-family
  // pairs is therefore equivalent to checking
  // `tarefa.familiaId === filho.familiaId`.
  return tarefa.familiaId === filho.familiaId;
}

function aggregatePending(
  seed: Seed,
  pDia: string,
  tarefaById: Map<string, SeedTarefa>,
  filhoById: Map<string, SeedFilho>,
  familiaById: Map<string, SeedFamilia>,
): Map<string, PendingAggregate> {
  const pendentes = new Map<string, PendingAggregate>();
  for (const a of seed.atribuicoes) {
    if (a.status !== 'pendente') continue;
    if (a.competencia !== pDia) continue;
    const tarefa = tarefaById.get(a.tarefaId);
    const filho = filhoById.get(a.filhoId);
    if (!tarefa || !filho) continue;
    if (!isAtribuicaoTarefaEligible(tarefa, filho)) continue;
    if (!familiaById.has(tarefa.familiaId)) continue;

    const key = `${tarefa.familiaId}|${filho.id}`;
    const cur = pendentes.get(key);
    if (cur) {
      cur.count += 1;
    } else {
      pendentes.set(key, { familiaId: tarefa.familiaId, filhoId: filho.id, count: 1 });
    }
  }
  return pendentes;
}

function isFilhoEligible(
  filho: SeedFilho | undefined,
  familiaId: string,
): filho is SeedFilho & { usuarioId: string } {
  if (!filho) return false;
  if (!filho.ativo) return false;
  if (filho.usuarioId === null) return false;
  return filho.familiaId === familiaId;
}

function isUsuarioEligible(usuario: SeedUsuario | undefined, familiaId: string): boolean {
  if (!usuario) return false;
  if (usuario.familiaId !== familiaId) return false;
  if (usuario.papel !== 'filho') return false;
  // COALESCE((notif_prefs->>'tarefasPendentes')::bool, true) = true
  // → null counts as `true`, false rejects, true accepts.
  if (usuario.tarefasPendentesPref === false) return false;
  return usuario.pushTokens.length > 0;
}

/**
 * Computes the eligibility set the same way
 * `public.selecionar_lembretes_pendentes(p_dia)` does, so the test
 * pins the SQL predicate to this exact specification (Property 2).
 *
 * Predicate (mirrors the migration):
 *   1. `atribuicoes.status = 'pendente'`                            (req 2.2)
 *   2. `atribuicoes.competencia = p_dia`                            (req 2.2, 2.3, 8.1)
 *   3. `tarefas.ativo AND excluida_em IS NULL AND arquivada_em IS NULL`
 *      AND `tarefas.familia_id = atribuicoes.familia_id`            (req 2.6, 5.3)
 *   4. group by (familia_id, filho_id) → pending_count >= 1         (req 2.2)
 *   5. join `filhos`: same familia_id, ativo = true, usuario_id NOT NULL
 *                                                                   (req 2.1, 8.2)
 *   6. join `usuarios`: id = filhos.usuario_id, same familia_id,
 *      papel = 'filho',
 *      COALESCE((notif_prefs->>'tarefasPendentes')::bool, true)     (req 2.1, 2.4, 5.3)
 *   7. EXISTS push_tokens for usuario_id                            (req 2.5)
 *   8. NOT EXISTS lembretes_envios for (filho_id, p_dia)            (req 4.1, 8.2 anti-join)
 */
function computeExpected(seed: Seed, pDia: string): ExpectedRow[] {
  const familiaById = new Map(seed.familias.map((f) => [f.id, f]));
  const tarefaById = new Map(seed.tarefas.map((t) => [t.id, t]));
  const filhoById = new Map(seed.filhos.map((f) => [f.id, f]));
  const usuarioById = new Map(seed.usuarios.map((u) => [u.id, u]));

  const pendentes = aggregatePending(seed, pDia, tarefaById, filhoById, familiaById);

  const lembreteKeys = new Set(
    seed.lembretes.filter((l) => l.dia === pDia).map((l) => `${l.filhoId}|${l.dia}`),
  );

  const out: ExpectedRow[] = [];
  for (const p of pendentes.values()) {
    const filho = filhoById.get(p.filhoId);
    if (!isFilhoEligible(filho, p.familiaId)) continue;
    const usuario = usuarioById.get(filho.usuarioId);
    if (!isUsuarioEligible(usuario, p.familiaId)) continue;
    if (lembreteKeys.has(`${filho.id}|${pDia}`)) continue;
    out.push({
      familia_id: p.familiaId,
      filho_id: filho.id,
      usuario_id: filho.usuarioId,
      pending_count: p.count,
    });
  }
  return out;
}

// Canonicalize for set comparison: sort by primary key triple so two
// equal sets compare deeply.
function canonicalize(rows: ExpectedRow[]): ExpectedRow[] {
  return [...rows].sort((a, b) => {
    if (a.familia_id !== b.familia_id) return a.familia_id < b.familia_id ? -1 : 1;
    if (a.filho_id !== b.filho_id) return a.filho_id < b.filho_id ? -1 : 1;
    return 0;
  });
}

// ─── DB seeding helpers ──────────────────────────────────────────────────────

async function seedAuthUsers(client: Client, usuarios: SeedUsuario[]): Promise<void> {
  if (usuarios.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const u of usuarios) {
    values.push(`($${p++}, $${p++})`);
    params.push(u.id, u.email);
  }
  // ON CONFLICT DO NOTHING because BEGIN/ROLLBACK guarantees no leftover
  // rows from prior iterations, but tests in different processes against
  // the same DB might race on the same UUID — fast-check shrinking
  // aside, the chance of a v4 UUID collision is negligible.
  await client.query(
    `INSERT INTO auth.users (id, email) VALUES ${values.join(',')} ON CONFLICT (id) DO NOTHING`,
    params,
  );
}

async function seedFamilias(client: Client, familias: SeedFamilia[]): Promise<void> {
  if (familias.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const f of familias) {
    values.push(`($${p++}, $${p++})`);
    params.push(f.id, f.nome);
  }
  await client.query(`INSERT INTO public.familias (id, nome) VALUES ${values.join(',')}`, params);
}

function buildNotifPrefs(pref: boolean | null): Record<string, boolean> {
  // Missing key must be treated by the predicate as `true`, so we use a
  // distinct key to keep the column non-empty without setting tarefasPendentes.
  if (pref === null) return { tarefaAprovada: true };
  return { tarefasPendentes: pref };
}

async function seedUsuarios(client: Client, usuarios: SeedUsuario[]): Promise<void> {
  if (usuarios.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const u of usuarios) {
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++}::jsonb)`);
    params.push(
      u.id,
      u.familiaId,
      u.papel,
      u.nome,
      JSON.stringify(buildNotifPrefs(u.tarefasPendentesPref)),
    );
  }
  await client.query(
    `INSERT INTO public.usuarios (id, familia_id, papel, nome, notif_prefs)
     VALUES ${values.join(',')}`,
    params,
  );
}

async function seedFilhos(client: Client, filhos: SeedFilho[]): Promise<void> {
  if (filhos.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const f of filhos) {
    values.push(`($${p++}, $${p++}, $${p++}, $${p++}, $${p++})`);
    params.push(f.id, f.familiaId, f.nome, f.usuarioId, f.ativo);
  }
  await client.query(
    `INSERT INTO public.filhos (id, familia_id, nome, usuario_id, ativo)
     VALUES ${values.join(',')}`,
    params,
  );
}

async function seedTarefas(client: Client, tarefas: SeedTarefa[]): Promise<void> {
  if (tarefas.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const t of tarefas) {
    values.push(
      `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++})`,
    );
    params.push(
      t.id,
      t.familiaId,
      t.titulo,
      t.pontos,
      t.diasSemana,
      t.ativo,
      t.arquivadaEm,
      t.excluidaEm,
      t.criadoPor,
    );
  }
  await client.query(
    `INSERT INTO public.tarefas
      (id, familia_id, titulo, pontos, dias_semana, ativo, arquivada_em, excluida_em, criado_por)
     VALUES ${values.join(',')}`,
    params,
  );
}

async function seedAtribuicoes(client: Client, atribuicoes: SeedAtribuicao[]): Promise<void> {
  if (atribuicoes.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const a of atribuicoes) {
    values.push(
      `($${p++}, $${p++}, $${p++}, $${p++}::public.atribuicao_status, $${p++}::date, $${p++}, $${p++}, $${p++})`,
    );
    // titulo_snapshot has DEFAULT '', exige_evidencia_snapshot DEFAULT
    // false. We pass empty strings and false so column defaults are
    // deterministic. familia_id is left to the BEFORE INSERT trigger,
    // which syncs it from filhos.familia_id (mirrors production).
    params.push(a.id, a.tarefaId, a.filhoId, a.status, a.competencia, a.pontosSnapshot, '', false);
  }
  await client.query(
    `INSERT INTO public.atribuicoes
      (id, tarefa_id, filho_id, status, competencia, pontos_snapshot,
       titulo_snapshot, exige_evidencia_snapshot)
     VALUES ${values.join(',')}`,
    params,
  );
}

async function seedPushTokens(client: Client, usuarios: SeedUsuario[]): Promise<void> {
  const inserts: { userId: string; token: string; deviceId: string }[] = [];
  for (const u of usuarios) {
    for (let i = 0; i < u.pushTokens.length; i++) {
      inserts.push({
        userId: u.id,
        token: u.pushTokens[i],
        deviceId: `test-device-${u.id.slice(0, 8)}-${i}`,
      });
    }
  }
  if (inserts.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const pt of inserts) {
    values.push(`($${p++}, $${p++}, $${p++})`);
    params.push(pt.userId, pt.token, pt.deviceId);
  }
  await client.query(
    `INSERT INTO public.push_tokens (user_id, token, device_id) VALUES ${values.join(',')}`,
    params,
  );
}

async function seedLembretes(client: Client, lembretes: SeedLembrete[]): Promise<void> {
  if (lembretes.length === 0) return;
  const values: string[] = [];
  const params: unknown[] = [];
  let p = 1;
  for (const l of lembretes) {
    values.push(`($${p++}, $${p++}, $${p++}::date, $${p++}, $${p++})`);
    params.push(l.familiaId, l.filhoId, l.dia, l.jitterSeconds, l.pendingCount);
  }
  await client.query(
    `INSERT INTO public.lembretes_envios
      (familia_id, filho_id, dia, jitter_seconds, pending_count)
     VALUES ${values.join(',')}`,
    params,
  );
}

async function seedDatabase(client: Client, seed: Seed): Promise<void> {
  // Order matters because of FKs:
  //   auth.users → usuarios.id → filhos.usuario_id → atribuicoes.filho_id
  //   familias  → usuarios/filhos/tarefas → atribuicoes → lembretes
  await seedAuthUsers(client, seed.usuarios);
  await seedFamilias(client, seed.familias);
  await seedUsuarios(client, seed.usuarios);
  await seedFilhos(client, seed.filhos);
  await seedTarefas(client, seed.tarefas);
  await seedAtribuicoes(client, seed.atribuicoes);
  await seedPushTokens(client, seed.usuarios);
  await seedLembretes(client, seed.lembretes);
}

// ─── Vitest suite ────────────────────────────────────────────────────────────

const seedArb = makeSeedArb();

describe.skipIf(!DB_URL)('selecionar_lembretes_pendentes — eligibility set', () => {
  let client: Client;

  beforeAll(async () => {
    if (!DB_URL) return;
    client = new Client({
      connectionString: DB_URL,
      // Supabase direct connections terminate TLS at PgBouncer/Proxy with
      // a self-signed certificate chain; verifying the chain locally
      // would block CI without adding security since this connection is
      // only used for transient property-test seeding.
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    // Statement timeout keeps a runaway iteration from holding locks.
    await client.query("SET statement_timeout = '20s'");
  }, 30_000);

  afterAll(async () => {
    if (client) await client.end();
  });

  /**
   * Property 2: Eligibility predicate is exactly the spec.
   *
   * For any randomly generated database state, the result of
   * `public.selecionar_lembretes_pendentes(p_dia)` equals the set of
   * `(familia_id, filho_id, usuario_id, pending_count)` tuples computed
   * by `computeExpected` — itself a literal transcription of the
   * predicate documented in Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6,
   * 5.3, 8.1, 8.2.
   *
   * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 5.3, 8.1, 8.2**
   */
  it(
    'RPC result equals the spec predicate over randomized seeds',
    { timeout: 600_000 },
    async () => {
      await fc.assert(
        fc.asyncProperty(seedArb, async (seed) => {
          await client.query('BEGIN');
          try {
            await seedDatabase(client, seed);

            const { rows } = await client.query<{
              familia_id: string;
              filho_id: string;
              usuario_id: string;
              pending_count: number;
            }>('SELECT * FROM public.selecionar_lembretes_pendentes($1::date)', [P_DIA]);

            // pg returns numeric INTs as numbers, but if the planner
            // ever swaps to bigint the .pending_count would arrive as a
            // string — normalize defensively.
            const actual: ExpectedRow[] = rows.map((r) => ({
              familia_id: r.familia_id,
              filho_id: r.filho_id,
              usuario_id: r.usuario_id,
              pending_count:
                typeof r.pending_count === 'string'
                  ? Number(r.pending_count)
                  : r.pending_count,
            }));

            const expected = computeExpected(seed, P_DIA);

            expect(canonicalize(actual)).toEqual(canonicalize(expected));
          } finally {
            await client.query('ROLLBACK');
          }
        }),
        { numRuns: NUM_RUNS },
      );
    },
  );
});
