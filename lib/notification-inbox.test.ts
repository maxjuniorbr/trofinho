import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import {
  deriveAdminNotifs,
  deriveChildNotifs,
  type AdminNotifInput,
  type ChildNotifInput,
} from './notification-inbox';
import type { AssignmentStatus } from './tasks';

// ── Test fixtures ────────────────────────────────────────

const FIXED_NOW = new Date('2026-04-18T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

// Helper: ISO string N minutes ago relative to FIXED_NOW
const minsAgo = (n: number) => new Date(FIXED_NOW.getTime() - n * 60_000).toISOString();
const hoursAgo = (n: number) => new Date(FIXED_NOW.getTime() - n * 3_600_000).toISOString();
const daysAgo = (n: number) => new Date(FIXED_NOW.getTime() - n * 86_400_000).toISOString();

describe('deriveAdminNotifs', () => {
  it('returns empty array when no tasks and no redemptions', () => {
    const input: AdminNotifInput = { tasks: [], redemptions: [] };
    expect(deriveAdminNotifs(input)).toEqual([]);
  });

  it('skips tasks without pending validation assignments', () => {
    const input: AdminNotifInput = {
      tasks: [
        {
          id: 't1',
          titulo: 'Lavar louça',
          pontos: 10,
          created_at: minsAgo(5),
          atribuicoes: [{ status: 'aprovada' }, { status: 'rejeitada' }],
        },
      ],
      redemptions: [],
    };
    expect(deriveAdminNotifs(input)).toEqual([]);
  });

  it('creates singular description when only one pending entry', () => {
    const input: AdminNotifInput = {
      tasks: [
        {
          id: 't1',
          titulo: 'Lavar louça',
          pontos: 10,
          created_at: minsAgo(5),
          atribuicoes: [{ status: 'aguardando_validacao' }],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveAdminNotifs(input);
    expect(n.description).toContain('1 entrega');
    expect(n.needsAction).toBe(true);
    expect(n.route).toBe('/(admin)/tasks');
    expect(n.audience).toBe('admin');
  });

  it('creates plural description with count when multiple pending entries', () => {
    const input: AdminNotifInput = {
      tasks: [
        {
          id: 't1',
          titulo: 'Lavar louça',
          pontos: 10,
          created_at: minsAgo(5),
          atribuicoes: [
            { status: 'aguardando_validacao' },
            { status: 'aguardando_validacao' },
            { status: 'aprovada' },
          ],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveAdminNotifs(input);
    expect(n.description).toContain('2 entregas');
  });

  it('includes pending redemptions with filho name and prize', () => {
    const input: AdminNotifInput = {
      tasks: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'pendente',
          pontos_debitados: 100,
          created_at: minsAgo(30),
          updated_at: minsAgo(30),
          filhos: { nome: 'Ana', usuario_id: 'u1' },
          premios: { nome: 'Sorvete', emoji: '🍦' },
        },
      ],
    };
    const [n] = deriveAdminNotifs(input);
    expect(n.description).toContain('Ana');
    expect(n.description).toContain('Sorvete');
    expect(n.description).toContain('100');
    expect(n.needsAction).toBe(true);
    expect(n.route).toBe('/(admin)/redemptions');
  });

  it('ignores non-pending redemptions', () => {
    const input: AdminNotifInput = {
      tasks: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'confirmado',
          pontos_debitados: 100,
          created_at: minsAgo(30),
          updated_at: minsAgo(5),
          filhos: { nome: 'Ana', usuario_id: 'u1' },
          premios: { nome: 'Sorvete', emoji: '🍦' },
        },
      ],
    };
    expect(deriveAdminNotifs(input)).toEqual([]);
  });

  it('orders results by group: Hoje → Ontem → Anterior', () => {
    const input: AdminNotifInput = {
      tasks: [
        {
          id: 'old',
          titulo: 'Old task',
          pontos: 10,
          created_at: daysAgo(5),
          atribuicoes: [{ status: 'aguardando_validacao' }],
        },
        {
          id: 'yesterday',
          titulo: 'Yesterday task',
          pontos: 10,
          created_at: daysAgo(1),
          atribuicoes: [{ status: 'aguardando_validacao' }],
        },
        {
          id: 'today',
          titulo: 'Today task',
          pontos: 10,
          created_at: minsAgo(10),
          atribuicoes: [{ status: 'aguardando_validacao' }],
        },
      ],
      redemptions: [],
    };
    const groups = deriveAdminNotifs(input).map((n) => n.group);
    expect(groups).toEqual(['Hoje', 'Ontem', 'Anterior']);
  });
});

describe('deriveChildNotifs', () => {
  it('returns empty array when nothing to report', () => {
    const input: ChildNotifInput = { assignments: [], redemptions: [] };
    expect(deriveChildNotifs(input)).toEqual([]);
  });

  it('reports approved assignments with points earned', () => {
    const input: ChildNotifInput = {
      assignments: [
        {
          id: 'a1',
          tarefa_id: 't1',
          filho_id: 'f1',
          status: 'aprovada',
          pontos_snapshot: 50,
          titulo_snapshot: 'Estudar matemática',
          descricao_snapshot: null,
          exige_evidencia_snapshot: false,
          evidencia_url: null,
          nota_rejeicao: null,
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
          tentativas: 0,
          tarefas: {
            id: 't1',
            titulo: 'Estudar matemática',
          } as ChildNotifInput['assignments'][number]['tarefas'],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.title).toContain('aprovada');
    expect(n.description).toContain('Estudar matemática');
    expect(n.description).toContain('50');
    expect(n.route).toBe('/(child)/tasks');
    expect(n.audience).toBe('child');
  });

  it('reports rejected assignments with rejection note when available', () => {
    const input: ChildNotifInput = {
      assignments: [
        {
          id: 'a1',
          tarefa_id: 't1',
          filho_id: 'f1',
          status: 'rejeitada',
          pontos_snapshot: 50,
          titulo_snapshot: 'Estudar',
          descricao_snapshot: null,
          exige_evidencia_snapshot: false,
          evidencia_url: null,
          nota_rejeicao: 'Foto ilegível',
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
          tentativas: 1,
          tarefas: {
            id: 't1',
            titulo: 'Estudar',
          } as ChildNotifInput['assignments'][number]['tarefas'],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.description).toContain('Foto ilegível');
  });

  it('falls back to generic message when rejection note is missing', () => {
    const input: ChildNotifInput = {
      assignments: [
        {
          id: 'a1',
          tarefa_id: 't1',
          filho_id: 'f1',
          status: 'rejeitada',
          pontos_snapshot: 50,
          titulo_snapshot: 'Estudar',
          descricao_snapshot: null,
          exige_evidencia_snapshot: false,
          evidencia_url: null,
          nota_rejeicao: null,
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
          tentativas: 1,
          tarefas: {
            id: 't1',
            titulo: 'Estudar',
          } as ChildNotifInput['assignments'][number]['tarefas'],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.description).toContain('Tente novamente');
  });

  it('reports confirmed and pending redemptions with different titles', () => {
    const input: ChildNotifInput = {
      assignments: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'confirmado',
          pontos_debitados: 100,
          created_at: hoursAgo(5),
          updated_at: minsAgo(30),
          premios: { nome: 'Sorvete', custo_pontos: 100, emoji: '🍦' },
        },
        {
          id: 'r2',
          filho_id: 'f1',
          premio_id: 'p2',
          status: 'pendente',
          pontos_debitados: 200,
          created_at: hoursAgo(1),
          updated_at: hoursAgo(1),
          premios: { nome: 'Brinquedo', custo_pontos: 200, emoji: '🧸' },
        },
      ],
    };
    const notifs = deriveChildNotifs(input);
    const confirmed = notifs.find((n) => n.id.startsWith('redemption-confirmed'));
    const pending = notifs.find((n) => n.id.startsWith('redemption-pending'));
    expect(confirmed?.title).toContain('confirmado');
    expect(pending?.title).toContain('análise');
  });

  it('handles null premios gracefully', () => {
    const input: ChildNotifInput = {
      assignments: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'confirmado',
          pontos_debitados: 100,
          created_at: hoursAgo(5),
          updated_at: minsAgo(30),
          premios: null,
        },
      ],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.description).toContain('Prêmio');
  });

  it('ignores cancelled redemptions', () => {
    const input: ChildNotifInput = {
      assignments: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'cancelado',
          pontos_debitados: 100,
          created_at: hoursAgo(5),
          updated_at: minsAgo(30),
          premios: { nome: 'Sorvete', custo_pontos: 100, emoji: '🍦' },
        },
      ],
    };
    expect(deriveChildNotifs(input)).toEqual([]);
  });
});

describe('deriveChildNotifs – cancelada filtering', () => {
  const makeAssignment = (
    overrides: Partial<ChildNotifInput['assignments'][number]>,
  ): ChildNotifInput['assignments'][number] => ({
    id: 'a1',
    tarefa_id: 't1',
    filho_id: 'f1',
    status: 'aprovada',
    pontos_snapshot: 10,
    titulo_snapshot: 'Test',
    descricao_snapshot: null,
    exige_evidencia_snapshot: false,
    evidencia_url: null,
    nota_rejeicao: null,
    concluida_em: minsAgo(10),
    validada_em: minsAgo(5),
    validada_por: 'admin1',
    created_at: minsAgo(60),
    competencia: null,
    tentativas: 0,
    tarefas: {
      id: 't1',
      titulo: 'Test',
    } as ChildNotifInput['assignments'][number]['tarefas'],
    ...overrides,
  });

  it('produces zero task notifications when all assignments are cancelada', () => {
    const input: ChildNotifInput = {
      assignments: [
        makeAssignment({ id: 'a1', status: 'cancelada' }),
        makeAssignment({ id: 'a2', status: 'cancelada' }),
      ],
      redemptions: [],
    };
    const notifs = deriveChildNotifs(input);
    const taskNotifs = notifs.filter((n) => n.type === 'task');
    expect(taskNotifs).toHaveLength(0);
  });

  it('produces notifications for aprovada/rejeitada but not cancelada in mixed list', () => {
    const input: ChildNotifInput = {
      assignments: [
        makeAssignment({ id: 'a1', status: 'cancelada' }),
        makeAssignment({ id: 'a2', status: 'aprovada', pontos_snapshot: 20 }),
        makeAssignment({ id: 'a3', status: 'rejeitada', nota_rejeicao: 'Incompleta' }),
        makeAssignment({ id: 'a4', status: 'cancelada' }),
      ],
      redemptions: [],
    };
    const notifs = deriveChildNotifs(input);
    const taskNotifs = notifs.filter((n) => n.type === 'task');
    expect(taskNotifs).toHaveLength(2);
    expect(taskNotifs.some((n) => n.id === 'task-approved-a2')).toBe(true);
    expect(taskNotifs.some((n) => n.id === 'task-rejected-a3')).toBe(true);
    // No notification references a cancelada assignment
    expect(taskNotifs.some((n) => n.id.includes('a1'))).toBe(false);
    expect(taskNotifs.some((n) => n.id.includes('a4'))).toBe(false);
  });
});

describe('edge cases: missing and malformed dates', () => {
  const makeAssignment = (
    overrides: Partial<ChildNotifInput['assignments'][number]>,
  ): ChildNotifInput['assignments'][number] => ({
    id: 'a1',
    tarefa_id: 't1',
    filho_id: 'f1',
    status: 'aprovada',
    pontos_snapshot: 10,
    titulo_snapshot: 'Test',
    descricao_snapshot: null,
    exige_evidencia_snapshot: false,
    evidencia_url: null,
    nota_rejeicao: null,
    concluida_em: minsAgo(10),
    validada_em: null,
    validada_por: null,
    created_at: minsAgo(60),
    competencia: null,
    tentativas: 0,
    tarefas: {
      id: 't1',
      titulo: 'Test',
    } as ChildNotifInput['assignments'][number]['tarefas'],
    ...overrides,
  });

  it('groups assignment as "Anterior" when validada_em is null and created_at is old', () => {
    const input: ChildNotifInput = {
      assignments: [makeAssignment({ validada_em: null, created_at: daysAgo(5) })],
      redemptions: [],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.group).toBe('Anterior');
  });

  it('returns empty relative time when validada_em is null and using created_at fallback', () => {
    const input: ChildNotifInput = {
      assignments: [makeAssignment({ validada_em: null, created_at: minsAgo(5) })],
      redemptions: [],
    };
    const [n] = deriveChildNotifs(input);
    expect(n.time).toBeTruthy();
  });

  it('handles very old dates without crashing', () => {
    const input: ChildNotifInput = {
      assignments: [makeAssignment({ validada_em: '2020-01-01T00:00:00Z' })],
      redemptions: [],
    };
    const notifs = deriveChildNotifs(input);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].group).toBe('Anterior');
  });

  it('handles future dates gracefully', () => {
    const input: ChildNotifInput = {
      assignments: [
        makeAssignment({ validada_em: new Date(FIXED_NOW.getTime() + 86_400_000).toISOString() }),
      ],
      redemptions: [],
    };
    const notifs = deriveChildNotifs(input);
    expect(notifs).toHaveLength(1);
  });

  it('admin notif groups as "Anterior" when task created_at is null-ish', () => {
    const input: AdminNotifInput = {
      tasks: [
        {
          id: 't1',
          titulo: 'Task',
          pontos: 10,
          created_at: '',
          atribuicoes: [{ status: 'aguardando_validacao' }],
        },
      ],
      redemptions: [],
    };
    const [n] = deriveAdminNotifs(input);
    expect(n.group).toBe('Anterior');
  });

  it('child approved assignment with null premios in redemption does not crash', () => {
    const input: ChildNotifInput = {
      assignments: [],
      redemptions: [
        {
          id: 'r1',
          filho_id: 'f1',
          premio_id: 'p1',
          status: 'pendente',
          pontos_debitados: 50,
          created_at: minsAgo(10),
          updated_at: minsAgo(10),
          premios: null,
        },
      ],
    };
    const notifs = deriveChildNotifs(input);
    expect(notifs).toHaveLength(1);
    expect(notifs[0].description).toContain('Prêmio');
  });
});


// ── Property-Based Tests ─────────────────────────────────

describe('Property tests — cancelled assignment notifications', () => {
  // Feature: task-soft-delete-and-cancelada, Property 2: Cancelled assignments produce zero child notifications
  // **Validates: Requirements 11.1, 11.2**
  it('P2: for any list of assignments with mixed statuses, deriveChildNotifs produces zero notifications referencing cancelada assignments', () => {
    const ALL_STATUSES: AssignmentStatus[] = [
      'pendente',
      'aguardando_validacao',
      'aprovada',
      'rejeitada',
      'cancelada',
    ];

    const arbStatus = fc.constantFrom(...ALL_STATUSES);

    const arbAssignment = fc.record({
      id: fc.uuid(),
      tarefa_id: fc.uuid(),
      filho_id: fc.uuid(),
      status: arbStatus,
      pontos_snapshot: fc.integer({ min: 1, max: 500 }),
      titulo_snapshot: fc.string({ minLength: 1, maxLength: 30 }),
      descricao_snapshot: fc.oneof(fc.constant(null), fc.string({ maxLength: 50 })),
      exige_evidencia_snapshot: fc.boolean(),
      evidencia_url: fc.constant(null),
      nota_rejeicao: fc.oneof(fc.constant(null), fc.constant('Motivo qualquer')),
      concluida_em: fc.oneof(
        fc.constant(null),
        fc.constant('2026-04-18T11:00:00.000Z'),
      ),
      validada_em: fc.oneof(
        fc.constant(null),
        fc.constant('2026-04-18T11:30:00.000Z'),
      ),
      validada_por: fc.oneof(fc.constant(null), fc.uuid()),
      created_at: fc.constant('2026-04-18T10:00:00.000Z'),
      competencia: fc.oneof(fc.constant(null), fc.constant('2026-04-18')),
      tentativas: fc.integer({ min: 0, max: 3 }),
      tarefas: fc.record({
        id: fc.uuid(),
        familia_id: fc.uuid(),
        titulo: fc.string({ minLength: 1, maxLength: 30 }),
        descricao: fc.oneof(fc.constant(null), fc.string({ maxLength: 50 })),
        pontos: fc.integer({ min: 1, max: 500 }),
        dias_semana: fc.integer({ min: 1, max: 127 }),
        exige_evidencia: fc.boolean(),
        criado_por: fc.oneof(fc.constant(null), fc.uuid()),
        created_at: fc.constant('2026-04-18T09:00:00.000Z'),
        ativo: fc.boolean(),
        arquivada_em: fc.oneof(fc.constant(null), fc.constant('2026-04-10T00:00:00.000Z')),
        excluida_em: fc.oneof(fc.constant(null), fc.constant('2026-04-15T00:00:00.000Z')),
      }),
    });

    fc.assert(
      fc.property(
        fc.array(arbAssignment, { minLength: 0, maxLength: 15 }),
        (assignments) => {
          const input: ChildNotifInput = {
            assignments,
            redemptions: [],
          };

          const notifs = deriveChildNotifs(input);

          // Collect IDs of all cancelada assignments
          const canceladaIds = new Set(
            assignments.filter((a) => a.status === 'cancelada').map((a) => a.id),
          );

          // No notification should reference a cancelada assignment ID
          for (const notif of notifs) {
            for (const canceladaId of canceladaIds) {
              expect(notif.id).not.toContain(canceladaId);
            }
          }

          // Additionally: the count of task notifications should equal
          // the count of aprovada + rejeitada assignments (not cancelada, pendente, or aguardando_validacao)
          const taskNotifs = notifs.filter((n) => n.type === 'task');
          const expectedCount = assignments.filter(
            (a) => a.status === 'aprovada' || a.status === 'rejeitada',
          ).length;
          expect(taskNotifs).toHaveLength(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });
});
