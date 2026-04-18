import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PiggyConfigSheet } from './piggy-config-sheet';

const createHostComponent = vi.hoisted(() => {
  return (name: string) =>
    React.forwardRef(function HostComponent(
      props: Record<string, unknown> & { children?: React.ReactNode },
      ref: React.ForwardedRef<unknown>,
    ) {
      return React.createElement(name, { ...props, ref }, props.children);
    });
});

vi.mock('react-native', () => ({
  KeyboardAvoidingView: createHostComponent('KeyboardAvoidingView'),
  Modal: createHostComponent('Modal'),
  ScrollView: createHostComponent('ScrollView'),
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: createHostComponent('Text'),
  View: createHostComponent('View'),
}));

vi.mock('lucide-react-native', () => ({
  Settings: (props: Record<string, unknown>) => React.createElement('Settings', props),
  X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/components/ui/screen-header', () => ({
  HeaderIconButton: ({
    onPress,
    accessibilityLabel,
  }: {
    onPress: () => void;
    accessibilityLabel: string;
  }) => React.createElement('Pressable', { onPress, accessibilityLabel }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

vi.mock('@/components/ui/stepped-slider', () => ({
  SteppedSlider: (props: Record<string, unknown>) => React.createElement('SteppedSlider', props),
}));

vi.mock('@/hooks/use-transient-message', () => ({
  useTransientMessage: (msg: string | null) => msg,
}));

vi.mock('@lib/haptics', () => ({
  hapticSuccess: vi.fn(),
}));

vi.mock('@/context/theme-context', () => ({
  useTheme: () => ({
    colors: {
      statusBar: 'dark',
      brand: { vivid: '#FAC114' },
      bg: { surface: '#fff', canvas: '#fff', muted: '#f5f5f5' },
      border: { subtle: '#eee' },
      text: { primary: '#000', secondary: '#666', muted: '#999' },
      accent: { admin: '#FAC114', adminDim: '#C57B0D', adminBg: '#FFF8E1' },
      overlay: { scrim: 'rgba(0,0,0,0.5)' },
    },
  }),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function allText(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAll((node) => (node.type as string) === 'Text')
    .map((node) => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (typeof children === 'number') return String(children);
      if (Array.isArray(children))
        return children
          .filter((c) => typeof c === 'string' || typeof c === 'number')
          .map(String)
          .join('');
      return '';
    })
    .join(' ');
}

const defaultProps = {
  visible: true,
  onClose: vi.fn(),
  appreciationRate: 10,
  withdrawalRate: 15,
  onSaveAppreciation: vi.fn().mockResolvedValue(undefined),
  onSaveWithdrawal: vi.fn().mockResolvedValue(undefined),
  savingAppreciation: false,
  savingWithdrawal: false,
};

describe('PiggyConfigSheet', () => {
  beforeEach(() => {
    defaultProps.onClose.mockReset();
    defaultProps.onSaveAppreciation.mockReset().mockResolvedValue(undefined);
    defaultProps.onSaveWithdrawal.mockReset().mockResolvedValue(undefined);
  });

  it('renders modal with correct visibility', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const modal = renderer.root.findAll((n) => (n.type as string) === 'Modal');
    expect(modal.length).toBe(1);
    expect(modal[0].props.visible).toBe(true);
  });

  it('is hidden when visible is false', () => {
    const renderer = render(
      React.createElement(PiggyConfigSheet, { ...defaultProps, visible: false }),
    );
    const modal = renderer.root.findAll((n) => (n.type as string) === 'Modal');
    expect(modal[0].props.visible).toBe(false);
  });

  it('renders title and subtitle', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const text = allText(renderer);
    expect(text).toContain('Configurar Cofrinho');
    expect(text).toContain('Regras só visíveis para você');
  });

  it('renders two sliders with correct initial values', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const sliders = renderer.root.findAll((n) => (n.type as string) === 'SteppedSlider');
    expect(sliders.length).toBe(2);
    expect(sliders[0].props.value).toBe(10);
    expect(sliders[1].props.value).toBe(15);
  });

  it('renders section labels', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const text = allText(renderer);
    expect(text).toContain('TAXA DE RENDIMENTO');
    expect(text).toContain('TAXA DE SAQUE ANTECIPADO');
  });

  it('calls onClose when close button is pressed', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const closeBtn = renderer.root.findAll(
      (n) =>
        (n.type as string) === 'Pressable' &&
        n.props.accessibilityLabel === 'Fechar configuração do cofrinho',
    );
    expect(closeBtn.length).toBe(1);
    act(() => {
      closeBtn[0].props.onPress();
    });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSaveAppreciation when slider completes', async () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const sliders = renderer.root.findAll((n) => (n.type as string) === 'SteppedSlider');
    await act(async () => {
      await sliders[0].props.onSlidingComplete(20);
    });
    expect(defaultProps.onSaveAppreciation).toHaveBeenCalledWith(20);
  });

  it('calls onSaveWithdrawal when slider completes', async () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const sliders = renderer.root.findAll((n) => (n.type as string) === 'SteppedSlider');
    await act(async () => {
      await sliders[1].props.onSlidingComplete(25);
    });
    expect(defaultProps.onSaveWithdrawal).toHaveBeenCalledWith(25);
  });

  it('renders close button', () => {
    const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
    const buttons = renderer.root.findAll((n) => (n.type as string) === 'Button');
    expect(buttons.length).toBe(1);
    expect(buttons[0].props.label).toBe('Fechar');
  });

  it('disables sliders when saving', () => {
    const renderer = render(
      React.createElement(PiggyConfigSheet, {
        ...defaultProps,
        savingAppreciation: true,
        savingWithdrawal: true,
      }),
    );
    const sliders = renderer.root.findAll((n) => (n.type as string) === 'SteppedSlider');
    expect(sliders[0].props.disabled).toBe(true);
    expect(sliders[1].props.disabled).toBe(true);
  });
});
