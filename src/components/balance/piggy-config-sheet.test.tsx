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
    Platform: { OS: 'ios' },
    Pressable: createHostComponent('Pressable'),
    ScrollView: createHostComponent('ScrollView'),
    StyleSheet: { create: <T,>(styles: T) => styles },
    Text: createHostComponent('Text'),
    TextInput: createHostComponent('TextInput'),
    View: createHostComponent('View'),
}));

vi.mock('lucide-react-native', () => ({
    Settings: (props: Record<string, unknown>) => React.createElement('Settings', props),
    X: (props: Record<string, unknown>) => React.createElement('X', props),
}));

vi.mock('@/components/ui/button', () => ({
    Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
    InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
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
    prazoBloqueioDias: 7,
    onSave: vi.fn().mockResolvedValue(undefined),
    saving: false,
};

describe('PiggyConfigSheet', () => {
    beforeEach(() => {
        defaultProps.onClose.mockReset();
        defaultProps.onSave.mockReset().mockResolvedValue(undefined);
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

    it('renders three number fields with correct initial values', () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const inputs = renderer.root.findAll((n) => (n.type as string) === 'TextInput');
        expect(inputs.length).toBe(3);
        expect(inputs[0].props.value).toBe('10');
        expect(inputs[1].props.value).toBe('15');
        expect(inputs[2].props.value).toBe('7');
    });

    it('renders all three field labels', () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const text = allText(renderer);
        expect(text).toContain('Taxa de rendimento (% ao mês)');
        expect(text).toContain('Taxa de saque antecipado (%)');
        expect(text).toContain('Prazo sem taxa (dias)');
    });

    it('renders helper text for each field', () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const text = allText(renderer);
        expect(text).toContain('Quanto o cofrinho rende a cada mês');
        expect(text).toContain('Cobrada quando o filho saca antes do prazo');
        expect(text).toContain('Dias para o depósito poder ser sacado sem taxa');
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

    it('strips non-digit characters from input', () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const inputs = renderer.root.findAll((n) => (n.type as string) === 'TextInput');
        act(() => {
            inputs[0].props.onChangeText('12abc.5');
        });
        const updated = renderer.root.findAll((n) => (n.type as string) === 'TextInput');
        expect(updated[0].props.value).toBe('125');
    });

    it('calls onSave with all three clamped values when save is pressed', async () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const inputs = renderer.root.findAll((n) => (n.type as string) === 'TextInput');
        act(() => {
            inputs[0].props.onChangeText('200'); // will clamp to 100
            inputs[1].props.onChangeText('80'); // will clamp to 50
            inputs[2].props.onChangeText('14');
        });
        const button = renderer.root.findAll(
            (n) =>
                (n.type as string) === 'Button' &&
                n.props.accessibilityLabel === 'Salvar configuração do cofrinho',
        )[0];
        await act(async () => {
            await button.props.onPress();
        });
        expect(defaultProps.onSave).toHaveBeenCalledWith({
            rate: 100,
            withdrawalRate: 50,
            prazo: 14,
        });
    });

    it('renders single save button with correct label', () => {
        const renderer = render(React.createElement(PiggyConfigSheet, defaultProps));
        const buttons = renderer.root.findAll((n) => (n.type as string) === 'Button');
        expect(buttons.length).toBe(1);
        expect(buttons[0].props.label).toBe('Salvar configuração');
    });

    it('passes saving state to button', () => {
        const renderer = render(
            React.createElement(PiggyConfigSheet, { ...defaultProps, saving: true }),
        );
        const button = renderer.root.findAll((n) => (n.type as string) === 'Button')[0];
        expect(button.props.loading).toBe(true);
    });
});
