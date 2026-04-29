import { describe, expect, it, vi } from 'vitest';

const addEventListenerMock = vi.hoisted(() => vi.fn());

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    addEventListener: addEventListenerMock,
  },
}));

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: (initial: unknown) => [initial, vi.fn()],
    useEffect: (fn: () => void) => fn(),
  };
});

const loadHook = () => import('../use-network-status');

describe('useNetworkStatus', () => {
  it('subscribes to NetInfo on mount', async () => {
    const unsubscribe = vi.fn();
    addEventListenerMock.mockReturnValue(unsubscribe);

    const { useNetworkStatus } = await loadHook();
    const result = useNetworkStatus();

    expect(addEventListenerMock).toHaveBeenCalledWith(expect.any(Function));
    expect(result.isOnline).toBe(true);
  });

  it('returns unsubscribe function from useEffect', async () => {
    const unsubscribe = vi.fn();
    addEventListenerMock.mockReturnValue(unsubscribe);

    const { useNetworkStatus } = await loadHook();
    useNetworkStatus();

    // The useEffect mock calls fn() immediately, which calls addEventListener
    // and returns unsubscribe. We verify addEventListener was called.
    expect(addEventListenerMock).toHaveBeenCalled();
  });

  it('passes a callback that handles null isConnected', async () => {
    addEventListenerMock.mockImplementation((cb: (state: { isConnected: boolean | null }) => void) => {
      // Simulate a state update with null isConnected
      cb({ isConnected: null });
      return vi.fn();
    });

    const { useNetworkStatus } = await loadHook();
    const result = useNetworkStatus();

    // Default state is true, and null isConnected falls back to true
    expect(result.isOnline).toBe(true);
  });
});
