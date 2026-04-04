import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';

const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const removeChannelMock = vi.hoisted(() => vi.fn());
const onMock = vi.hoisted(() => vi.fn());
const subscribeMock = vi.hoisted(() => vi.fn());
const channelMock = vi.hoisted(() => ({
  on: onMock,
  subscribe: subscribeMock,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock('@lib/supabase', () => ({
  supabase: {
    channel: vi.fn(() => channelMock),
    removeChannel: removeChannelMock,
  },
}));

import { supabase } from '@lib/supabase';
import { useTasksLiveSync } from '../use-tasks-live-sync';

const TEST_FAMILIA_ID = 'familia-123';

function TestComponent({ familiaId }: { familiaId?: string }) {
  useTasksLiveSync(familiaId);
  return null;
}

describe('useTasksLiveSync', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset();
    removeChannelMock.mockReset();
    subscribeMock.mockReset();
    onMock.mockReset();
    onMock.mockReturnValue(channelMock);
    subscribeMock.mockReturnValue(channelMock);
    vi.mocked(supabase.channel).mockClear();
  });

  it('subscribes to task-related tables and invalidates tasks.all on changes', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<TestComponent familiaId={TEST_FAMILIA_ID} />);
    });

    // Only tarefas is subscribed (filtered by familia_id).
    // atribuicoes was removed to prevent cross-family data leaks (S2).
    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenNthCalledWith(
      1,
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tarefas', filter: `familia_id=eq.${TEST_FAMILIA_ID}` },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const taskListener = onMock.mock.calls[0][2] as () => void;

    taskListener();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });

  it('does not subscribe when familiaId is undefined', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<TestComponent />);
    });

    expect(supabase.channel).not.toHaveBeenCalled();
    expect(subscribeMock).not.toHaveBeenCalled();

    act(() => {
      renderer.unmount();
    });

    expect(removeChannelMock).not.toHaveBeenCalled();
  });
});
