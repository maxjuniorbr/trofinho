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

import { useTasksLiveSync } from '../use-tasks-live-sync';

function TestComponent() {
  useTasksLiveSync();
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
  });

  it('subscribes to task-related tables and invalidates tasks.all on changes', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<TestComponent />);
    });

    expect(onMock).toHaveBeenNthCalledWith(
      1,
      'postgres_changes',
      { event: '*', schema: 'public', table: 'atribuicoes' },
      expect.any(Function),
    );
    expect(onMock).toHaveBeenNthCalledWith(
      2,
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tarefas' },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const assignmentListener = onMock.mock.calls[0][2] as () => void;
    const taskListener = onMock.mock.calls[1][2] as () => void;

    assignmentListener();
    taskListener();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: queryKeys.tasks.all });
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(2);

    act(() => {
      renderer.unmount();
    });

    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });
});
