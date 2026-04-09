import React from 'react';
import {act, create, type ReactTestRenderer} from '../../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';

import { supabase } from '@lib/supabase';
import { useBalanceLiveSync } from '../use-balance-live-sync';

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

const TEST_CHILD_ID = 'child-uuid-123';

function TestComponent({ childId }: { childId?: string }) {
  useBalanceLiveSync(childId);
  return null;
}

describe('useBalanceLiveSync', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset();
    removeChannelMock.mockReset();
    subscribeMock.mockReset();
    onMock.mockReset();
    onMock.mockReturnValue(channelMock);
    subscribeMock.mockReturnValue(channelMock);
    vi.mocked(supabase.channel).mockClear();
  });

  it('subscribes to saldos filtered by filho_id and invalidates balances.all on update', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<TestComponent childId={TEST_CHILD_ID} />);
    });

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'saldos',
        filter: `filho_id=eq.${TEST_CHILD_ID}`,
      },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const listener = onMock.mock.calls[0][2] as () => void;

    listener();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: queryKeys.balances.all });
    expect(invalidateQueriesMock).toHaveBeenCalledTimes(1);

    act(() => {
      renderer.unmount();
    });

    expect(removeChannelMock).toHaveBeenCalledWith(channelMock);
  });

  it('does not subscribe when childId is undefined', () => {
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
