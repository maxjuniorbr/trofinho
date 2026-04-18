import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deriveAdminNotifs,
  deriveChildNotifs,
  type AdminNotifInput,
  type ChildNotifInput,
} from './notification-inbox';

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
          premios: { nome: 'Sorvete' },
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
          premios: { nome: 'Sorvete' },
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
          evidencia_url: null,
          nota_rejeicao: null,
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
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
          evidencia_url: null,
          nota_rejeicao: 'Foto ilegível',
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
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
          evidencia_url: null,
          nota_rejeicao: null,
          concluida_em: minsAgo(30),
          validada_em: minsAgo(10),
          validada_por: 'admin1',
          created_at: minsAgo(60),
          competencia: null,
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
          premios: { nome: 'Sorvete', custo_pontos: 100 },
        },
        {
          id: 'r2',
          filho_id: 'f1',
          premio_id: 'p2',
          status: 'pendente',
          pontos_debitados: 200,
          created_at: hoursAgo(1),
          updated_at: hoursAgo(1),
          premios: { nome: 'Brinquedo', custo_pontos: 200 },
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
          premios: { nome: 'Sorvete', custo_pontos: 100 },
        },
      ],
    };
    expect(deriveChildNotifs(input)).toEqual([]);
  });
});
