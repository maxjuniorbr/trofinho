/**
 * Notification derivation from real query data.
 *
 * Pure functions that transform assignments, redemptions, etc. into
 * a flat notification list. No Supabase calls — data comes from hooks.
 */

import type { ChildAssignment } from './tasks';
import type { RedemptionWithChildAndPrize, RedemptionWithPrize } from './redemptions';
import type { NotificationRoute } from './notifications';
import { toDateString } from './utils';

export type NotifType = 'task' | 'redemption' | 'penalty' | 'appreciation';
export type NotifGroup = 'Hoje' | 'Ontem' | 'Anterior';
export type NotifAudience = 'admin' | 'child';

export interface Notif {
  id: string;
  audience: NotifAudience;
  type: NotifType;
  title: string;
  description: string;
  time: string;
  group: NotifGroup;
  needsAction?: boolean;
  route?: NotificationRoute;
}

// ── Helpers ──────────────────────────────────────────────

function dateGroup(isoDate: string | null | undefined): NotifGroup {
  if (!isoDate) return 'Anterior';
  const today = toDateString(new Date());
  const yesterday = toDateString(new Date(Date.now() - 86_400_000));
  const d = isoDate.slice(0, 10);
  if (d === today) return 'Hoje';
  if (d === yesterday) return 'Ontem';
  return 'Anterior';
}

function relativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const parsed = new Date(isoDate).getTime();
  if (Number.isNaN(parsed)) return '';
  const diffMs = Date.now() - parsed;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ontem';
  return `há ${days} dias`;
}

// ── Admin derivation ─────────────────────────────────────

export type AdminNotifInput = {
  /** Task list items with lightweight assignment statuses */
  tasks: readonly {
    id: string;
    titulo: string;
    pontos: number;
    created_at: string;
    atribuicoes: readonly { status: string }[];
  }[];
  /** All redemptions visible to admin */
  redemptions: readonly RedemptionWithChildAndPrize[];
};

export function deriveAdminNotifs(input: AdminNotifInput): Notif[] {
  const notifs: Notif[] = [];

  // Tasks with assignments awaiting validation → one notification per task
  for (const task of input.tasks) {
    const pendingCount = task.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
    if (pendingCount === 0) continue;
    notifs.push({
      id: `task-${task.id}`,
      audience: 'admin',
      type: 'task',
      title: 'Tarefa aguardando aprovação',
      description:
        pendingCount === 1
          ? `'${task.titulo}' tem 1 entrega para revisar`
          : `'${task.titulo}' tem ${pendingCount} entregas para revisar`,
      time: relativeTime(task.created_at),
      group: dateGroup(task.created_at),
      needsAction: true,
      route: '/(admin)/tasks',
    });
  }

  // Pending redemptions → redemption notifications with needsAction
  for (const r of input.redemptions) {
    if (r.status !== 'pendente') continue;
    notifs.push({
      id: `redemption-${r.id}`,
      audience: 'admin',
      type: 'redemption',
      title: 'Resgate aguardando confirmação',
      description: `${r.filhos.nome} quer resgatar '${r.premios.nome}' (${r.pontos_debitados} pts)`,
      time: relativeTime(r.created_at),
      group: dateGroup(r.created_at),
      needsAction: true,
      route: '/(admin)/redemptions',
    });
  }

  // Sort: most recent first
  notifs.sort((a, b) => groupOrder(a.group) - groupOrder(b.group));

  return notifs;
}

// ── Child derivation ─────────────────────────────────────

export type ChildNotifInput = {
  assignments: readonly ChildAssignment[];
  redemptions: readonly RedemptionWithPrize[];
};

export function deriveChildNotifs(input: ChildNotifInput): Notif[] {
  const notifs: Notif[] = [];

  // Recently approved assignments → positive feedback
  for (const a of input.assignments) {
    if (a.status !== 'aprovada') continue;
    const refDate = a.validada_em ?? a.created_at;
    notifs.push({
      id: `task-approved-${a.id}`,
      audience: 'child',
      type: 'task',
      title: 'Tarefa aprovada! 🎉',
      description: `'${a.tarefas.titulo}' foi aprovada (+${a.pontos_snapshot} pts)`,
      time: relativeTime(refDate),
      group: dateGroup(refDate),
      route: '/(child)/tasks',
    });
  }

  // Recently rejected assignments → feedback
  for (const a of input.assignments) {
    if (a.status !== 'rejeitada') continue;
    const refDate = a.validada_em ?? a.created_at;
    notifs.push({
      id: `task-rejected-${a.id}`,
      audience: 'child',
      type: 'task',
      title: 'Tarefa rejeitada',
      description: a.nota_rejeicao
        ? `'${a.tarefas.titulo}': ${a.nota_rejeicao}`
        : `'${a.tarefas.titulo}' foi rejeitada. Tente novamente!`,
      time: relativeTime(refDate),
      group: dateGroup(refDate),
      route: '/(child)/tasks',
    });
  }

  // Confirmed redemptions → positive feedback
  for (const r of input.redemptions) {
    if (r.status !== 'confirmado') continue;
    const prizeName = r.premios?.nome ?? 'Prêmio';
    notifs.push({
      id: `redemption-confirmed-${r.id}`,
      audience: 'child',
      type: 'redemption',
      title: 'Resgate confirmado! 🎁',
      description: `'${prizeName}' foi aprovado pelos pais`,
      time: relativeTime(r.updated_at),
      group: dateGroup(r.updated_at),
      route: '/(child)/redemptions',
    });
  }

  // Pending redemptions → waiting state
  for (const r of input.redemptions) {
    if (r.status !== 'pendente') continue;
    const prizeName = r.premios?.nome ?? 'Prêmio';
    notifs.push({
      id: `redemption-pending-${r.id}`,
      audience: 'child',
      type: 'redemption',
      title: 'Resgate em análise',
      description: `'${prizeName}' aguardando aprovação dos pais`,
      time: relativeTime(r.created_at),
      group: dateGroup(r.created_at),
      route: '/(child)/redemptions',
    });
  }

  notifs.sort((a, b) => groupOrder(a.group) - groupOrder(b.group));

  return notifs;
}

// ── Shared ───────────────────────────────────────────────

const GROUP_ORDER: Record<NotifGroup, number> = { Hoje: 0, Ontem: 1, Anterior: 2 };

function groupOrder(g: NotifGroup): number {
  return GROUP_ORDER[g];
}
