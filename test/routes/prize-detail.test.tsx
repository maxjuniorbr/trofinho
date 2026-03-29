import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Hoisted mocks ---

const alertMock = vi.hoisted(() => ({
  alert: vi.fn(),
}));

const routerMock = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  dismissTo: vi.fn(),
  replace: vi.fn(),
}));

const prizeDetailMock = vi.hoisted(() => ({
  data: undefined as
    | {
        id: string;
        familia_id: string;
        nome: string;
        descricao: string | null;
        custo_pontos: number;
        imagem_url: string | null;
        ativo: boolean;
        created_at: string;
      }
    | undefined,
  isLoading: false,
  error: null as Error | null,
  refetch: vi.fn(),
}));

const updatePrizeMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const deactivatePrizeMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
}));

const reactivatePrizeMock = vi.hoisted(() => ({
  mutate: vi.fn(),
  isPending: false,
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

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, item) => ({ ...acc, ...flattenStyle(item) }),
      {},
    );
  }
  if (style && typeof style === 'object') return style as Record<string, unknown>;
  return {};
}

// Override react-native mock to include Alert and Switch
vi.mock('react-native', () => {
  class AnimatedValue {
    constructor(private readonly initialValue: number) {}
    interpolate(config: { outputRange: unknown[] }) {
      return config.outputRange[0] ?? this.initialValue;
    }
  }

  return {
    ActivityIndicator: createHostComponent('ActivityIndicator'),
    Alert: alertMock,
    Animated: {
      View: createHostComponent('Animated.View'),
      Value: AnimatedValue,
      parallel: vi.fn(() => ({ start: vi.fn() })),
      spring: vi.fn(() => ({})),
      timing: vi.fn(() => ({})),
    },
    Image: createHostComponent('Image'),
    KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
    Platform: { OS: 'android' },
    Pressable: createHostComponent('Pressable'),
    ScrollView: createHostComponent('ScrollView'),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
      flatten: flattenStyle,
      absoluteFillObject: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
    },
    Switch: createHostComponent('Switch'),
    Text: createHostComponent('Text'),
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
  };
});

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'prize-1' }),
  useRouter: () => routerMock,
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('@lib/navigation-feedback', () => ({
  setNavigationFeedback: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  usePrizeDetail: () => prizeDetailMock,
  useUpdatePrize: () => updatePrizeMock,
  useDeactivatePrize: () => deactivatePrizeMock,
  useReactivatePrize: () => reactivatePrizeMock,
}));

// Mock child components to avoid deep dependency chains
vi.mock('@/components/ui/sticky-footer-screen', () => ({
  StickyFooterScreen: ({ children }: { children: React.ReactNode }) =>
    React.createElement('StickyFooterScreen', null, children),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) =>
    React.createElement('Button', props),
}));

vi.mock('@/components/ui/empty-state', () => ({
  EmptyState: (props: Record<string, unknown>) =>
    React.createElement('EmptyState', props),
}));

vi.mock('@/components/ui/form-footer', () => ({
  FormFooter: ({ children }: { children: React.ReactNode }) =>
    React.createElement('FormFooter', null, children),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) =>
    React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  ScreenHeader: (props: Record<string, unknown>) =>
    React.createElement('ScreenHeader', props),
}));

vi.mock('@/components/prizes/prize-form-fields', () => ({
  PrizeFormFields: (props: Record<string, unknown>) =>
    React.createElement('PrizeFormFields', props),
}));

vi.mock('lucide-react-native', () => ({
  ImagePlus: (props: Record<string, unknown>) =>
    React.createElement('ImagePlus', props),
}));

import AdminPrizeDetailScreen from '../../app/(admin)/prizes/[id]';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function findSwitch(renderer: ReactTestRenderer) {
  return renderer.root.findAll(
    (node) =>
      node.props.accessibilityLabel ===
      'Alternar disponibilidade do prêmio',
  )[0];
}

const activePrize = {
  id: 'prize-1',
  familia_id: 'fam-1',
  nome: 'Sorvete',
  descricao: 'Um sorvete bem gostoso',
  custo_pontos: 50,
  imagem_url: null,
  ativo: true,
  created_at: '2024-01-01T00:00:00Z',
};

describe('Prize detail — deactivation confirmation (Q28)', () => {
  beforeEach(() => {
    alertMock.alert.mockReset();
    routerMock.back.mockReset();
    routerMock.dismissTo.mockReset();
    prizeDetailMock.data = { ...activePrize };
    prizeDetailMock.isLoading = false;
    prizeDetailMock.error = null;
    prizeDetailMock.refetch.mockReset();
    updatePrizeMock.mutate.mockReset();
    updatePrizeMock.isPending = false;
    deactivatePrizeMock.mutate.mockReset();
    deactivatePrizeMock.isPending = false;
    reactivatePrizeMock.mutate.mockReset();
    reactivatePrizeMock.isPending = false;
  });

  // **Validates: Requirements 1.1, 1.5**
  it('shows Alert.alert with correct title, message, and buttons when toggling OFF', () => {
    const renderer = render(<AdminPrizeDetailScreen />);
    const switchEl = findSwitch(renderer);

    act(() => {
      switchEl.props.onValueChange(false);
    });

    expect(alertMock.alert).toHaveBeenCalledTimes(1);
    expect(alertMock.alert).toHaveBeenCalledWith(
      'Desativar prêmio?',
      'O prêmio não aparecerá para os filhos enquanto estiver inativo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: expect.any(Function),
        },
      ],
    );
  });

  // **Validates: Requirements 1.2**
  it('sets isActive to false when confirming deactivation', () => {
    deactivatePrizeMock.mutate.mockImplementation((_id: string, opts: { onSuccess?: (result: { warning: string | null }) => void }) => {
      opts.onSuccess?.({ warning: null });
    });

    const renderer = render(<AdminPrizeDetailScreen />);
    const switchEl = findSwitch(renderer);

    act(() => {
      switchEl.props.onValueChange(false);
    });

    const buttons = alertMock.alert.mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;
    const desativarButton = buttons.find((b) => b.text === 'Desativar');

    act(() => {
      desativarButton!.onPress!();
    });

    const updatedSwitch = findSwitch(renderer);
    expect(updatedSwitch.props.value).toBe(false);
  });

  // **Validates: Requirements 1.3**
  it('keeps isActive as true when canceling deactivation', () => {
    const renderer = render(<AdminPrizeDetailScreen />);
    const switchEl = findSwitch(renderer);

    act(() => {
      switchEl.props.onValueChange(false);
    });

    // Cancel = no onPress callback invoked; state stays unchanged
    const updatedSwitch = findSwitch(renderer);
    expect(updatedSwitch.props.value).toBe(true);
  });

  // **Validates: Requirements 1.4**
  it('sets isActive to true without showing alert when toggling ON', () => {
    prizeDetailMock.data = { ...activePrize, ativo: false };

    reactivatePrizeMock.mutate.mockImplementation((_id: string, opts: { onSuccess?: () => void }) => {
      opts.onSuccess?.();
    });

    const renderer = render(<AdminPrizeDetailScreen />);
    const switchEl = findSwitch(renderer);

    expect(switchEl.props.value).toBe(false);

    act(() => {
      switchEl.props.onValueChange(true);
    });

    expect(alertMock.alert).not.toHaveBeenCalled();

    const updatedSwitch = findSwitch(renderer);
    expect(updatedSwitch.props.value).toBe(true);
  });
});
