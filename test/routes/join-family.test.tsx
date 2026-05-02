import React from 'react';
import { act, create, type ReactTestRenderer } from '../helpers/test-renderer-compat';
import { Pressable, Text, TextInput } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Add missing icon to lucide mock before importing the component
vi.mock('lucide-react-native', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    function createIcon(name: string) {
        const Icon = React.forwardRef(function Icon(
            props: Record<string, unknown>,
            ref: React.ForwardedRef<unknown>,
        ) {
            return React.createElement(name, { ...props, ref });
        });
        Icon.displayName = `Icon(${name})`;
        return Icon;
    }
    return {
        ...actual,
        Hash: actual.Hash ?? createIcon('Hash'),
    };
});

// eslint-disable-next-line import/first
import JoinFamilyScreen from '../../app/(auth)/join-family';

const routerMock = vi.hoisted(() => ({
    back: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
    canGoBack: vi.fn().mockReturnValue(true),
}));

const validateInviteResult = vi.hoisted(() => ({
    data: null as { familia_nome: string; admin_nome: string } | null,
    isLoading: false,
    error: null as Error | null,
}));

const acceptInviteMock = vi.hoisted(() => ({
    mutateAsync: vi.fn(),
    isPending: false,
    reset: vi.fn(),
}));

vi.mock('expo-router', () => ({
    useRouter: () => routerMock,
}));

vi.mock('@/hooks/queries/use-admin-invite', () => ({
    useValidateInvite: () => validateInviteResult,
    useAcceptInvite: () => acceptInviteMock,
}));

vi.mock('@lib/auth', () => ({
    refreshAuthSession: vi.fn().mockResolvedValue({ error: null }),
}));

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

function changeInput(renderer: ReactTestRenderer, index: number, value: string) {
    const inputs = renderer.root.findAllByType(TextInput);
    act(() => {
        inputs[index]?.props.onChangeText(value);
    });
}

function pressButton(renderer: ReactTestRenderer, label: string) {
    const button = renderer.root
        .findAllByType(Pressable)
        .find((node) => node.props.accessibilityLabel === label);
    if (!button) throw new Error(`Button not found: ${label}`);
    return act(async () => {
        await button.props.onPress?.();
    });
}

function screenText(renderer: ReactTestRenderer): string {
    return renderer.root
        .findAllByType(Text)
        .map((n) => n.props.children)
        .flat()
        .filter((c): c is string => typeof c === 'string')
        .join(' ');
}

describe('JoinFamilyScreen', () => {
    beforeEach(() => {
        routerMock.back.mockReset();
        routerMock.push.mockReset();
        routerMock.replace.mockReset();
        validateInviteResult.data = null;
        validateInviteResult.isLoading = false;
        validateInviteResult.error = null;
        acceptInviteMock.mutateAsync.mockReset().mockResolvedValue({ familia_id: 'fam-1' });
        acceptInviteMock.isPending = false;
        acceptInviteMock.reset.mockReset();
    });

    it('renders the join family screen with code input', () => {
        const renderer = render(<JoinFamilyScreen />);
        const text = screenText(renderer);
        expect(text).toContain('Ingressar na família');
        expect(text).toContain('Convite');
    });

    it('shows validating text when code is complete and validating', () => {
        validateInviteResult.isLoading = true;
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        const text = screenText(renderer);
        expect(text).toContain('Verificando código');
    });

    it('shows preview card when validation succeeds', () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        const text = screenText(renderer);
        expect(text).toContain('Família Silva');
        expect(text).toContain('João');
    });

    it('shows name field when preview is available', () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        const inputs = renderer.root.findAllByType(TextInput);
        expect(inputs.length).toBeGreaterThanOrEqual(2);
    });

    it('shows error when name is empty on submit', async () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        await pressButton(renderer, 'Ingressar na família');
        const text = screenText(renderer);
        expect(text).toContain('Informe seu nome');
    });

    it('calls acceptInvite.mutateAsync when form is valid', async () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        changeInput(renderer, 1, 'Maria');
        await pressButton(renderer, 'Ingressar na família');
        expect(acceptInviteMock.mutateAsync).toHaveBeenCalledWith({
            code: 'ABC123',
            name: 'Maria',
        });
    });

    it('shows error when acceptInvite fails', async () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        acceptInviteMock.mutateAsync.mockRejectedValueOnce(new Error('Família já tem 2 admins'));
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        changeInput(renderer, 1, 'Maria');
        await pressButton(renderer, 'Ingressar na família');
        const text = screenText(renderer);
        expect(text).toContain('Família já tem 2 admins');
    });

    it('shows generic error when acceptInvite throws non-Error', async () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        acceptInviteMock.mutateAsync.mockRejectedValueOnce('unknown');
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        changeInput(renderer, 1, 'Maria');
        await pressButton(renderer, 'Ingressar na família');
        const text = screenText(renderer);
        expect(text).toContain('Erro ao ingressar na família');
    });

    it('shows validation error when code is invalid', async () => {
        validateInviteResult.error = new Error('Código inválido ou expirado');
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'XXXXXX');
        await pressButton(renderer, 'Ingressar na família');
        const text = screenText(renderer);
        expect(text).toContain('Código inválido ou expirado');
    });

    it('navigates back when back button is pressed', async () => {
        const renderer = render(<JoinFamilyScreen />);
        await pressButton(renderer, 'Voltar');
        expect(routerMock.back).toHaveBeenCalled();
    });

    it('navigates back when secondary button is pressed', async () => {
        const renderer = render(<JoinFamilyScreen />);
        await pressButton(renderer, 'Voltar para criação de família');
        expect(routerMock.back).toHaveBeenCalled();
    });

    it('auto-uppercases and limits code input to 6 chars', () => {
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'abc12345678');
        const inputs = renderer.root.findAllByType(TextInput);
        expect(inputs[0].props.value).toBe('ABC123');
    });

    it('shows refreshAuthSession error when session refresh fails', async () => {
        validateInviteResult.data = { familia_nome: 'Família Silva', admin_nome: 'João' };
        const authModule = await import('@lib/auth');
        vi.mocked(authModule.refreshAuthSession).mockResolvedValueOnce({ error: 'Session expired' });
        const renderer = render(<JoinFamilyScreen />);
        changeInput(renderer, 0, 'ABC123');
        changeInput(renderer, 1, 'Maria');
        await pressButton(renderer, 'Ingressar na família');
        const text = screenText(renderer);
        expect(text).toContain('Session expired');
    });
});
