import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChildSelectionSheet } from '../child-selection-sheet';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const childrenMock = vi.hoisted(() => ({
    data: [] as {
        id: string;
        nome: string;
        ativo: boolean;
        usuario_id: string | null;
        avatar_url: string | null;
    }[],
    isLoading: false,
    error: null as Error | null,
}));

const balancesMock = vi.hoisted(() => ({
    data: [] as { filho_id: string; saldo_livre: number; cofrinho: number }[],
    isLoading: false,
    error: null as Error | null,
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@/hooks/queries', () => ({
    useChildrenList: () => childrenMock,
    useAdminBalances: () => balancesMock,
}));

vi.mock('@/components/ui/avatar', () => ({
    Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ChildSelectionSheet', () => {
    const onClose = vi.fn();
    const onSelectChild = vi.fn();

    beforeEach(() => {
        onClose.mockReset();
        onSelectChild.mockReset();

        childrenMock.data = [
            { id: 'c1', nome: 'Ana', ativo: true, usuario_id: 'u1', avatar_url: null },
            { id: 'c2', nome: 'Pedro', ativo: true, usuario_id: null, avatar_url: null },
            { id: 'c3', nome: 'Inativo', ativo: false, usuario_id: null, avatar_url: null },
        ];
        childrenMock.isLoading = false;
        childrenMock.error = null;

        balancesMock.data = [
            { filho_id: 'c1', saldo_livre: 100, cofrinho: 50 },
            { filho_id: 'c2', saldo_livre: 30, cofrinho: 20 },
        ];
        balancesMock.isLoading = false;
        balancesMock.error = null;
    });

    // Requisito 2.1 — modal abre quando visible=true
    it('renders the modal when visible is true', () => {
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const modal = renderer.root.findAll((n) => n.type === 'Modal');
        expect(modal.length).toBeGreaterThan(0);
        expect(modal[0].props.visible).toBe(true);
    });

    // Requisito 2.6 — modal fecha (visible=false não renderiza conteúdo do modal)
    it('passes visible=false to the underlying Modal', () => {
        const renderer = render(
            <ChildSelectionSheet visible={false} onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const modal = renderer.root.findAll((n) => n.type === 'Modal');
        expect(modal.length).toBeGreaterThan(0);
        expect(modal[0].props.visible).toBe(false);
    });

    // Requisito 2.2 — apenas filhos ativos são exibidos
    it('renders only active children', () => {
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const text = allText(renderer);
        expect(text).toContain('Ana');
        expect(text).toContain('Pedro');
        expect(text).not.toContain('Inativo');
    });

    // Requisito 2.4 — onSelectChild é chamado com dados corretos
    it('calls onSelectChild with correct child data on press', () => {
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const pressables = renderer.root.findAll(
            (n) =>
                n.type === 'Pressable' &&
                typeof n.props.accessibilityLabel === 'string' &&
                n.props.accessibilityLabel.startsWith('Selecionar'),
        );
        expect(pressables.length).toBe(2);

        act(() => {
            pressables[0].props.onPress();
        });
        expect(onSelectChild).toHaveBeenCalledWith({ id: 'c1', nome: 'Ana' });

        act(() => {
            pressables[1].props.onPress();
        });
        expect(onSelectChild).toHaveBeenCalledWith({ id: 'c2', nome: 'Pedro' });
    });

    // Requisito 2.5 — estado vazio quando não há filhos ativos
    it('shows empty state when there are no active children', () => {
        childrenMock.data = [
            { id: 'c3', nome: 'Inativo', ativo: false, usuario_id: null, avatar_url: null },
        ];
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const text = allText(renderer);
        expect(text).toContain('Nenhum filho ativo encontrado');
    });

    // Requisito 2.5 — estado vazio com lista completamente vazia
    it('shows empty state when children list is empty', () => {
        childrenMock.data = [];
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const text = allText(renderer);
        expect(text).toContain('Nenhum filho ativo encontrado');
    });

    // Requisito 2.6 — onClose é propagado para o BottomSheetModal
    it('propagates onClose to the underlying modal', () => {
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        // The BottomSheetModal renders Pressable elements with the closeLabel for closing
        const closeTargets = renderer.root.findAll(
            (n) =>
                n.type === 'Pressable' &&
                n.props.accessibilityLabel === 'Fechar seleção de filho',
        );
        expect(closeTargets.length).toBeGreaterThan(0);
        act(() => {
            closeTargets[0].props.onPress();
        });
        expect(onClose).toHaveBeenCalled();
    });

    // Requisito 2.3 — exibe saldo total (saldo_livre + cofrinho)
    it('displays total points for each child', () => {
        const renderer = render(
            <ChildSelectionSheet visible onClose={onClose} onSelectChild={onSelectChild} />,
        );
        const text = allText(renderer);
        expect(text).toContain('150 pts'); // Ana: 100 + 50
        expect(text).toContain('50 pts');  // Pedro: 30 + 20
    });
});
