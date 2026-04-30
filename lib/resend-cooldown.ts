/**
 * Persists the "last sent" timestamp for email cooldowns so the timer
 * survives component unmounts and screen navigation.
 *
 * Each caller provides a unique `key` (e.g. "confirmation", "recovery")
 * so different flows have independent cooldowns.
 */

const timestamps = new Map<string, number>();

export function markSent(key: string): void {
  timestamps.set(key, Date.now());
}

/**
 * Returns the number of seconds remaining in the cooldown window,
 * or 0 if the cooldown has expired (or was never started).
 */
export function remainingCooldown(key: string, cooldownSeconds: number): number {
  const sentAt = timestamps.get(key);
  if (sentAt == null) return 0;

  const elapsed = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, cooldownSeconds - elapsed);
}

/** Clears all persisted cooldowns. Intended for tests only. */
export function resetAllCooldowns(): void {
  timestamps.clear();
}
