type DateInput = Date | string | null | undefined;

export function formatDate(date: DateInput): string {
  if (!date) return '';
  const d = toLocalDate(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDateShort(date: DateInput): string {
  if (!date) return '';
  const d = toLocalDate(date);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

export function parseDate(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const parsedDate = new Date(Number(year), Number(month) - 1, Number(day));

  if (Number.isNaN(parsedDate.getTime())) return null;
  if (parsedDate.getDate() !== Number(day)) return null;
  if (parsedDate.getMonth() !== Number(month) - 1) return null;
  if (parsedDate.getFullYear() !== Number(year)) return null;

  return parsedDate;
}

function toLocalDate(value: Date | string): Date {
  if (typeof value !== 'string') return value;
  const suffix = value.includes('T') ? '' : 'T00:00:00';
  return new Date(value + suffix);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Returns a human-friendly date label:
 * - "Hoje" / "Ontem"
 * - "Há N dias" for 2..7 days ago
 * - "Sex, 11/04" for older dates in same year
 * - "11/04/2025" for older dates in different year
 */
export function formatDateRelative(date: DateInput, today: Date = new Date()): string {
  if (!date) return '';
  const d = startOfDay(toLocalDate(date));
  const ref = startOfDay(today);
  const diffMs = ref.getTime() - d.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  if (diffDays >= 2 && diffDays <= 7) return `Há ${diffDays} dias`;

  if (d.getFullYear() === ref.getFullYear()) {
    const weekday = WEEKDAY_LABELS[d.getDay()];
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${weekday}, ${day}/${month}`;
  }

  return formatDate(d);
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}
