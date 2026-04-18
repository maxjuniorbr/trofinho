import React from 'react';
import { act, create } from '../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const focusManagerMock = vi.hoisted(() => ({ setFocused: vi.fn() }));
const addEventListenerMock = vi.hoisted(() => vi.fn());
const removeMock = vi.hoisted(() => vi.fn());

vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(function () {
    return {};
  }),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  focusManager: focusManagerMock,
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: addEventListenerMock,
  },
}));

beforeEach(() => {
  focusManagerMock.setFocused.mockClear();
  addEventListenerMock.mockClear();
  removeMock.mockClear();
  addEventListenerMock.mockReturnValue({ remove: removeMock });
});

const loadProvider = () => import('../query-client').then((m) => m.QueryProvider);

describe('QueryProvider', () => {
  it('subscribes to AppState changes on mount', async () => {
    const QueryProvider = await loadProvider();

    act(() => {
      create(
        <QueryProvider>
          <></>
        </QueryProvider>,
      );
    });

    expect(addEventListenerMock).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('sets focusManager to true when app becomes active', async () => {
    const QueryProvider = await loadProvider();

    act(() => {
      create(
        <QueryProvider>
          <></>
        </QueryProvider>,
      );
    });

    const listener = addEventListenerMock.mock.calls[0][1] as (status: string) => void;

    act(() => listener('active'));
    expect(focusManagerMock.setFocused).toHaveBeenCalledWith(true);
  });

  it('sets focusManager to false when app goes to background', async () => {
    const QueryProvider = await loadProvider();

    act(() => {
      create(
        <QueryProvider>
          <></>
        </QueryProvider>,
      );
    });

    const listener = addEventListenerMock.mock.calls[0][1] as (status: string) => void;

    act(() => listener('background'));
    expect(focusManagerMock.setFocused).toHaveBeenCalledWith(false);
  });

  it('sets focusManager to false when app becomes inactive', async () => {
    const QueryProvider = await loadProvider();

    act(() => {
      create(
        <QueryProvider>
          <></>
        </QueryProvider>,
      );
    });

    const listener = addEventListenerMock.mock.calls[0][1] as (status: string) => void;

    act(() => listener('inactive'));
    expect(focusManagerMock.setFocused).toHaveBeenCalledWith(false);
  });

  it('removes the AppState listener on unmount', async () => {
    const QueryProvider = await loadProvider();

    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <QueryProvider>
          <></>
        </QueryProvider>,
      );
    });

    act(() => {
      renderer.unmount();
    });

    expect(removeMock).toHaveBeenCalledTimes(1);
  });
});
