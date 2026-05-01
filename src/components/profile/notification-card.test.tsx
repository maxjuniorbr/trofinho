import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Switch, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { NotificationCard } from './notification-card';
import type { NotificationPrefs } from '@lib/notifications';

const ALL_FALSE_PREFS: NotificationPrefs = {
    tarefasPendentes: false,
    tarefaAprovada: false,
    tarefaRejeitada: false,
    tarefaConcluida: false,
    resgatesSolicitado: false,
    resgateConfirmado: false,
    resgateCancelado: false,
    resgateCofrinhoSolicitado: false,
    resgateCofrinhoConfirmado: false,
    resgateCofrinhoCancelado: false,
    penalidadeAplicada: false,
};

function render(overrides: Partial<React.ComponentProps<typeof NotificationCard>> = {}) {
    const props = {
        preferences: ALL_FALSE_PREFS,
        ...overrides,
    };
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<NotificationCard {...props} />);
    });
    return renderer;
}

function getTextContents(renderer: ReactTestRenderer): string[] {
    return renderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .filter((c): c is string => typeof c === 'string');
}

describe('NotificationCard', () => {
    it('renders admin-specific options when role="admin"', () => {
        const renderer = render({ role: 'admin' });
        const texts = getTextContents(renderer);

        expect(texts).toContain('Tarefas pendentes');
        expect(texts).toContain('Tarefa concluída pelo filho');
        expect(texts).toContain('Resgate solicitado');
        // Should NOT contain child-specific options
        expect(texts).not.toContain('Tarefa aprovada');
        expect(texts).not.toContain('Tarefa rejeitada');
    });

    it('renders child-specific options when role="filho"', () => {
        const renderer = render({ role: 'filho' });
        const texts = getTextContents(renderer);

        expect(texts).toContain('Tarefa aprovada');
        expect(texts).toContain('Tarefa rejeitada');
        expect(texts).toContain('Resgate confirmado');
        expect(texts).toContain('Resgate cancelado');
        // Should NOT contain admin-specific options
        expect(texts).not.toContain('Tarefas pendentes');
        expect(texts).not.toContain('Tarefa concluída pelo filho');
    });

    it('calls onPreferencesChange with updated prefs when a switch toggles', () => {
        const onPreferencesChange = vi.fn();
        const renderer = render({ role: 'admin', onPreferencesChange });

        const switches = renderer.root.findAllByType(Switch);
        expect(switches.length).toBeGreaterThan(0);

        act(() => {
            switches[0].props.onValueChange(true);
        });

        expect(onPreferencesChange).toHaveBeenCalledWith(
            expect.objectContaining({ tarefasPendentes: true }),
        );
    });

    it('shows "Salvando preferências..." text when saving=true', () => {
        const renderer = render({ saving: true });
        const texts = getTextContents(renderer);

        expect(texts).toContain('Salvando preferências...');
    });

    it('shows error InlineMessage when error is provided', () => {
        const renderer = render({ error: 'Falha ao salvar' });
        const texts = getTextContents(renderer);

        expect(texts).toContain('Falha ao salvar');
    });

    it('switches are disabled when disabled=true', () => {
        const renderer = render({ role: 'admin', disabled: true });
        const switches = renderer.root.findAllByType(Switch);

        expect(switches.length).toBeGreaterThan(0);
        for (const sw of switches) {
            expect(sw.props.disabled).toBe(true);
        }
    });
});
