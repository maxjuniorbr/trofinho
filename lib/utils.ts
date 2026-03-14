/** Formats a Date (or ISO string) to dd/mm/yyyy in pt-BR locale. */
export function formatarData(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Parses a dd/mm/yyyy string into a Date or returns null if invalid. */
export function parsearData(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Converts a Date to YYYY-MM-DD for API/database use. */
export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Returns a time-of-day greeting in pt-BR. */
export function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}
