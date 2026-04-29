import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Must mock react before importing the hook
const setStateMock = vi.fn();
let lastEffect: (() => (() => void) | void) | null = null;

vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, setStateMock],
  useEffect: (fn: () => (() => void) | void) => {
    lastEffect = fn;
  },
}));

const loadHook = () => import('../use-transient-message');

describe('useTransientMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setStateMock.mockClear();
    lastEffect = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the initial message as visible', async () => {
    const { useTransientMessage } = await loadHook();
    const result = useTransientMessage('Hello');
    // useState is called with the message, so the initial return is the message
    expect(result).toBe('Hello');
  });

  it('returns null when message is null', async () => {
    const { useTransientMessage } = await loadHook();
    const result = useTransientMessage(null);
    expect(result).toBeNull();
  });

  it('sets visible message to null when input message is null', async () => {
    const { useTransientMessage } = await loadHook();
    useTransientMessage(null);

    // Execute the effect
    expect(lastEffect).not.toBeNull();
    const cleanup = lastEffect!();

    expect(setStateMock).toHaveBeenCalledWith(null);
    // No cleanup needed when message is null (no timer set)
    expect(cleanup).toBeUndefined();
  });

  it('sets visible message and schedules auto-clear after default duration', async () => {
    const { useTransientMessage } = await loadHook();
    useTransientMessage('Success!');

    expect(lastEffect).not.toBeNull();
    const cleanup = lastEffect!();

    // setVisibleMessage(message) called
    expect(setStateMock).toHaveBeenCalledWith('Success!');

    // Timer should clear after 4000ms (default)
    vi.advanceTimersByTime(3999);
    // The updater function hasn't been called yet at 3999ms
    expect(setStateMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    // Now the timer fires — calls setVisibleMessage with an updater function
    expect(setStateMock).toHaveBeenCalledTimes(2);
    const updater = setStateMock.mock.calls[1][0];
    expect(typeof updater).toBe('function');

    // The updater clears the message if it matches
    expect(updater('Success!')).toBeNull();
    // The updater preserves a different message (race condition protection)
    expect(updater('Different')).toBe('Different');

    // Cleanup clears the timer
    expect(typeof cleanup).toBe('function');
  });

  it('uses custom duration when provided', async () => {
    const { useTransientMessage } = await loadHook();
    useTransientMessage('Quick', { durationMs: 1000 });

    expect(lastEffect).not.toBeNull();
    lastEffect!();

    vi.advanceTimersByTime(999);
    expect(setStateMock).toHaveBeenCalledTimes(1); // only the initial set

    vi.advanceTimersByTime(1);
    expect(setStateMock).toHaveBeenCalledTimes(2); // timer fired
  });

  it('cleanup function clears the timeout', async () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { useTransientMessage } = await loadHook();
    useTransientMessage('Msg');

    const cleanup = lastEffect!();
    expect(typeof cleanup).toBe('function');
    (cleanup as () => void)();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
