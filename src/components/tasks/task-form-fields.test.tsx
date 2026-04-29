import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Switch } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { TaskFormFields } from './task-form-fields';

const DEFAULT_PROPS = {
    title: '',
    description: '',
    points: '',
    diasSemana: 0,
    requiresEvidence: false,
    onTitleChange: vi.fn(),
    onDescriptionChange: vi.fn(),
    onPointsChange: vi.fn(),
    onDiasSemanaChange: vi.fn(),
    onRequiresEvidenceChange: vi.fn(),
};

function render(overrides: Partial<typeof DEFAULT_PROPS> = {}) {
    const props = { ...DEFAULT_PROPS, ...overrides };
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(<TaskFormFields {...props} />);
    });
    return { renderer, props };
}

function findByA11yLabel(renderer: ReactTestRenderer, label: string) {
    const results = renderer.root.findAll((node) => node.props.accessibilityLabel === label);
    if (results.length === 0) throw new Error(`No node with accessibilityLabel "${label}"`);
    return results[0];
}

describe('TaskFormFields', () => {
    it('renders all 5 fields: title, description, points, weekday selector, evidence switch', () => {
        const { renderer } = render();

        const titleInput = findByA11yLabel(renderer, 'Título da tarefa');
        const descriptionInput = findByA11yLabel(renderer, 'Descrição da tarefa');
        const pointsInput = findByA11yLabel(renderer, 'Quantidade de pontos da tarefa');
        // WeekdaySelector renders 7 Pressable buttons with weekday labels
        const domingo = findByA11yLabel(renderer, 'Domingo');
        // Evidence switch
        const evidenceSwitch = findByA11yLabel(renderer, 'Alternar exigência de foto como evidência');

        expect(titleInput).toBeTruthy();
        expect(descriptionInput).toBeTruthy();
        expect(pointsInput).toBeTruthy();
        expect(domingo).toBeTruthy();
        expect(evidenceSwitch).toBeTruthy();
    });

    it('calls onTitleChange when title input changes', () => {
        const onTitleChange = vi.fn();
        const { renderer } = render({ onTitleChange });

        const titleInput = findByA11yLabel(renderer, 'Título da tarefa');
        act(() => {
            titleInput.props.onChangeText('Nova tarefa');
        });

        expect(onTitleChange).toHaveBeenCalledWith('Nova tarefa');
    });

    it('calls onPointsChange with digits only (strips non-numeric chars)', () => {
        const onPointsChange = vi.fn();
        const { renderer } = render({ onPointsChange });

        const pointsInput = findByA11yLabel(renderer, 'Quantidade de pontos da tarefa');
        act(() => {
            pointsInput.props.onChangeText('12abc34');
        });

        expect(onPointsChange).toHaveBeenCalledWith('1234');
    });

    it('calls onRequiresEvidenceChange when switch toggles', () => {
        const onRequiresEvidenceChange = vi.fn();
        const { renderer } = render({ onRequiresEvidenceChange });

        const switches = renderer.root.findAllByType(Switch);
        expect(switches.length).toBeGreaterThanOrEqual(1);

        act(() => {
            switches[0].props.onValueChange(true);
        });

        expect(onRequiresEvidenceChange).toHaveBeenCalledWith(true);
    });

    it('renders with pointsEditable=false — points input has disabled style', () => {
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(
                <TaskFormFields {...DEFAULT_PROPS} pointsEditable={false} />,
            );
        });

        const pointsInput = findByA11yLabel(renderer, 'Quantidade de pontos da tarefa');

        expect(pointsInput.props.editable).toBe(false);
        // The component applies a style with opacity: 0.55 when not editable
        const flatStyle = [pointsInput.props.style].flat(Infinity);
        const hasDisabledOpacity = flatStyle.some(
            (s: Record<string, unknown> | undefined) => s && s.opacity === 0.55,
        );
        expect(hasDisabledOpacity).toBe(true);
    });

    it('renders with weekdaysEditable=false — weekday selector is disabled', () => {
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(
                <TaskFormFields {...DEFAULT_PROPS} weekdaysEditable={false} />,
            );
        });

        const domingo = findByA11yLabel(renderer, 'Domingo');
        expect(domingo.props.accessibilityState.disabled).toBe(true);
    });
});
