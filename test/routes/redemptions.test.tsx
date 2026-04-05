// Feature: ux-polish-fase4b, Property 6: Cancellation dialog includes dynamic values
// Feature: ux-polish-fase4b, Property 8: Destructive action executes if and only if user confirms
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import fc from 'fast-check';

import AdminRedemptionsScreen from '../../app/(admin)/redemptions/index';

// --- Hoisted mocks ---

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
}));

const cancelMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const confirmMutationMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const redemptionsMock = vi.hoisted(() => ({
  data: undefined as
    | {
        pages: {
          data: {
            id: string;
            status: string;
            pontos_debitados: number;
            created_at: string;
            filhos: { nome: string; usuario_id: string | null };
            premios: { nome: string };
          }[];
          hasMore: boolean;
        }[];
        pageParams: number[];
      }
    | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  isFetchingNextPage: false,
}));

const createHostComponent = vi.hoisted(() => {
  return (name: string) =>
    React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) {
      return React.createElement(name, { ...props, ref }, props.children);
    });
});

vi.mock('react-native', () => {
  return {
    ActivityIndicator: createHostComponent('ActivityIndicator'),
    Alert: alertMock,
    Modal: createHostComponent('Modal'),
    Pressable: createHostComponent('Pressable'),
    RefreshControl: createHostComponent('RefreshControl'),
    ScrollView: createHostComponent('ScrollView'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Text: createHostComponent('Text'),
    View: createHostComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    renderItem,
    ListHeaderComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
  }) =>
    React.createElement(
      'FlashList',
      null,
      ListHeaderComponent,
      data.map((item, index) => renderItem({ item, index })),
    ),
}));

vi.mock('@/hooks/queries', () => ({
  useAdminRedemptions: () => redemptionsMock,
  useConfirmRedemption: () => confirmMutationMock,
  useCancelRedemption: () => cancelMutationMock,
  useProfile: () => ({
    data: { id: 'admin-1', familia_id: 'fam-1', nome: 'Admin', papel: 'admin' },
  }),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) => React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) => React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/ui/safe-screen-frame', () => ({
  SafeScreenFrame: ({ children }: { children: React.ReactNode }) =>
    React.createElement('SafeScreenFrame', null, children),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function makePendingRedemption(id: string, childName: string, prizeName: string, points: number) {
  return {
    id,
    status: 'pendente',
    pontos_debitados: points,
    created_at: '2024-01-01T00:00:00Z',
    filhos: { nome: childName, usuario_id: null },
    premios: { nome: prizeName },
  };
}

/** Find the "Cancelar" button for a specific redemption card by looking for XCircle icon sibling */
function findCancelButton(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => (n.type as string) === 'Text');
      return texts.some((t) => t.props.children === 'Cancelar');
    } catch {
      return false;
    }
  });
}

/** Find the modal's "Cancelar resgate" confirm button */
function findModalConfirmButton(renderer: ReactTestRenderer) {
  // The modal confirm button has text "Cancelar resgate" inside a Pressable
  return renderer.root.findAll((node) => {
    if ((node.type as string) !== 'Pressable') return false;
    try {
      const texts = node.findAll((n) => (n.type as string) === 'Text');
      return texts.some((t) => t.props.children === 'Cancelar resgate');
    } catch {
      return false;
    }
  });
}

describe('AdminRedemptionsScreen — cancellation dialog property tests', () => {
  beforeEach(() => {
    alertMock.alert.mockReset();
    cancelMutationMock.mutate.mockReset();
    confirmMutationMock.mutate.mockReset();
    redemptionsMock.data = undefined;
    redemptionsMock.isLoading = false;
    redemptionsMock.error = null;
    redemptionsMock.refetch.mockReset();
  });

  // **Validates: Requirements 3.2**
  it('P6: cancellation dialog message contains the points value for any points', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 99999 }),
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        (points, childName) => {
          alertMock.alert.mockReset();

          redemptionsMock.data = {
            pages: [
              {
                data: [makePendingRedemption('r-1', childName, 'Premio Teste', points)],
                hasMore: false,
              },
            ],
            pageParams: [0],
          };

          const renderer = render(<AdminRedemptionsScreen />);

          // Step 1: Press the "Cancelar" button on the redemption card to open the modal
          const cancelButtons = findCancelButton(renderer);
          expect(cancelButtons.length).toBeGreaterThan(0);
          act(() => {
            cancelButtons[0].props.onPress();
          });

          // Step 2: Press the "Cancelar resgate" button in the modal to trigger Alert.alert
          const modalConfirmButtons = findModalConfirmButton(renderer);
          expect(modalConfirmButtons.length).toBeGreaterThan(0);
          act(() => {
            modalConfirmButtons[0].props.onPress();
          });

          // Step 3: Verify Alert.alert was called with the points in the message
          expect(alertMock.alert).toHaveBeenCalledTimes(1);
          const message = alertMock.alert.mock.calls[0][1] as string;
          expect(message).toContain(String(points));
        },
      ),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.4, 3.5**
  it('P8-cancel: cancel mutation is called only when user confirms the Alert, not on dismiss', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 99999 }), fc.boolean(), (points, userConfirms) => {
        alertMock.alert.mockReset();
        cancelMutationMock.mutate.mockReset();

        redemptionsMock.data = {
          pages: [
            {
              data: [makePendingRedemption('r-1', 'Filho Teste', 'Premio Teste', points)],
              hasMore: false,
            },
          ],
          pageParams: [0],
        };

        const renderer = render(<AdminRedemptionsScreen />);

        // Open modal
        const cancelButtons = findCancelButton(renderer);
        act(() => {
          cancelButtons[0].props.onPress();
        });

        // Trigger Alert from modal
        const modalConfirmButtons = findModalConfirmButton(renderer);
        act(() => {
          modalConfirmButtons[0].props.onPress();
        });

        expect(alertMock.alert).toHaveBeenCalledTimes(1);
        const buttons = alertMock.alert.mock.calls[0][2] as {
          text: string;
          style: string;
          onPress?: () => void;
        }[];

        if (userConfirms) {
          const destructiveBtn = buttons.find((b) => b.style === 'destructive');
          act(() => {
            destructiveBtn!.onPress!();
          });
          expect(cancelMutationMock.mutate).toHaveBeenCalledTimes(1);
        } else {
          // User cancels — do not press the destructive button
          expect(cancelMutationMock.mutate).not.toHaveBeenCalled();
        }
      }),
      { numRuns: 100 },
    );
  });
});
