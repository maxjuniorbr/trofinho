import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { queryKeys } from '../query-keys';

import { supabase } from '@lib/supabase';
import { useRedemptionsLiveSync } from '../use-redemptions-live-sync';

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

const TEST_FAMILIA_ID = 'familia-123';

function TestComponent({ familiaId }: { familiaId?: string }) {
  useRedemptionsLiveSync(familiaId);
  return null;
}

describe('useRedemptionsLiveSync', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockReset();
    removeChannelMock.mockReset();
    subscribeMock.mockReset();
    onMock.mockReset();
    onMock.mockReturnValue(channelMock);
    subscribeMock.mockReturnValue(channelMock);
    vi.mocked(supabase.channel).mockClear();
  });

  it('subscribes to resgates table filtered by familia_id and invalidates redemptions.all on changes', () => {
    let renderer!: ReactTestRenderer;
    act(() => {
      renderer = create(<TestComponent familiaId={TEST_FAMILIA_ID} />);
    });

    expect(onMock).toHaveBeenCalledTimes(1);
    expect(onMock).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'resgates',
        filter: `familia_id=eq.${TEST_FAMILIA_ID}`,
      },
      expect.any(Function),
    );
    expect(subscribeMock).toHaveBeenCalledTimes(1);

    const listener = onMock.mock.calls[0][2] as () => void;
    listener();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({ queryKey: queryKeys.redemptions.all });
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

  it('invalidates on every change event independently', () => {
    act(() => {
      create(<TestComponent familiaId={TEST_FAMILIA_ID} />);
    });

    const listener = onMock.mock.calls[0][2] as () => void;
    listener();
    listener();
    listener();

    expect(invalidateQueriesMock).toHaveBeenCalledTimes(3);
  });
});
