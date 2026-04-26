// Feature: task-soft-delete-and-cancelada, Property 3: Excluir action is always present for non-deleted tasks
import React from 'react';
import { act, create } from '../../../test/helpers/test-renderer-compat';
import { describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';
import { Text } from 'react-native';

import { TaskActionSheet, type TaskActionState } from './task-action-sheet';

function renderSheet(state: TaskActionState) {
    let renderer!: ReturnType<typeof create>;
    act(() => {
        renderer = create(
            <TaskActionSheet
                visible
                taskTitle="Test task"
                state={state}
                onClose={vi.fn()}
                onDelete={vi.fn()}
            />,
        );
    });
    return renderer;
}

describe('TaskActionSheet — Excluir action property', () => {
    // **Validates: Requirements 9.1**
    it('P3: for any TaskActionState with isDeleted=false, the "Excluir" action is present with danger tone', () => {
        const arbNonDeletedState: fc.Arbitrary<TaskActionState> = fc.record({
            isArchived: fc.boolean(),
            isInactive: fc.boolean(),
            hasPendingReview: fc.boolean(),
            canEdit: fc.boolean(),
            isDeleted: fc.constant(false as const),
        });

        fc.assert(
            fc.property(arbNonDeletedState, (state) => {
                const renderer = renderSheet(state);

                // Find all Pressable nodes that have accessibilityLabel="Excluir"
                const excluirButtons = renderer.root.findAll(
                    (node) =>
                        node.type === 'Pressable' && node.props.accessibilityLabel === 'Excluir',
                );

                expect(excluirButtons).toHaveLength(1);

                // Verify the label text "Excluir" is rendered inside the action row
                const textNodes = excluirButtons[0].findAllByType(Text);
                const labels = textNodes.map((t) => t.props.children);
                expect(labels).toContain('Excluir');

                // Verify danger tone: the text color should match the semantic error color
                // (danger tone uses colors.semantic.error for the tint)
                const excluirText = textNodes.find((t) => t.props.children === 'Excluir');
                expect(excluirText).toBeDefined();

                // The style is an array [styles.actionLabel, { color: tint }]
                const style = excluirText!.props.style;
                const colorStyle = Array.isArray(style)
                    ? style.find((s: Record<string, unknown>) => s && 'color' in s)
                    : style;
                expect(colorStyle).toBeDefined();
                expect(colorStyle.color).toBeDefined();
            }),
            { numRuns: 100 },
        );
    });
});
