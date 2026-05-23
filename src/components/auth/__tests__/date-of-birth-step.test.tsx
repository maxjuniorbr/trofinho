import React from 'react';
import { Pressable, Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';

import { DateOfBirthStep } from '../date-of-birth-step';

/**
 * Unit tests for DateOfBirthStep component.
 *
 * Validates: Requirements 3.1, 3.4
 */

vi.mock('@react-native-community/datetimepicker', () => {
    const MockDateTimePicker = (props: Record<string, unknown>) =>
        React.createElement('DateTimePicker', props);
    return {
        __esModule: true,
        default: MockDateTimePicker,
    };
});

function render(element: React.ReactElement): ReactTestRenderer {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

function getTextContents(renderer: ReactTestRenderer): string[] {
    return renderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .filter((c): c is string => typeof c === 'string');
}

describe('DateOfBirthStep', () => {
    it('renders validation message when no date is selected', () => {
        const renderer = render(
            <DateOfBirthStep
                value={null}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Informe sua data de nascimento para continuar.');

        act(() => {
            renderer.unmount();
        });
    });

    it('does not render validation message when a date is provided', () => {
        const renderer = render(
            <DateOfBirthStep
                value={new Date(2000, 0, 15)}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        const texts = getTextContents(renderer);
        expect(texts).not.toContain('Informe sua data de nascimento para continuar.');

        act(() => {
            renderer.unmount();
        });
    });

    it('passes the selected date value to the DateTimePicker', () => {
        const selectedDate = new Date(2000, 0, 15);
        const renderer = render(
            <DateOfBirthStep
                value={selectedDate}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        // On Android the picker starts hidden — tap the date field to open it
        const dateField = renderer.root.findAllByType(Pressable).find(
            (p) => p.props.accessibilityLabel === 'Selecionar data de nascimento',
        );
        act(() => {
            dateField!.props.onPress();
        });

        const picker = renderer.root.findByType('DateTimePicker' as never);
        expect(picker.props.value).toBe(selectedDate);

        act(() => {
            renderer.unmount();
        });
    });

    it('renders error message when error prop is provided', () => {
        const renderer = render(
            <DateOfBirthStep
                value={null}
                onChange={() => undefined}
                onContinue={() => undefined}
                error="Data inválida"
                loading={false}
            />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Data inválida');
        // When error is present, the info validation message should not show
        expect(texts).not.toContain('Informe sua data de nascimento para continuar.');

        act(() => {
            renderer.unmount();
        });
    });

    it('continue button is disabled when no date is selected', () => {
        const renderer = render(
            <DateOfBirthStep
                value={null}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        // The Button component renders a Pressable with disabled prop
        const pressables = renderer.root.findAllByType(Pressable);
        const continueButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Continuar',
        );

        expect(continueButton).toBeTruthy();
        expect(continueButton!.props.disabled).toBe(true);

        act(() => {
            renderer.unmount();
        });
    });

    it('continue button is enabled when a date is selected', () => {
        const renderer = render(
            <DateOfBirthStep
                value={new Date(2000, 0, 15)}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        const pressables = renderer.root.findAllByType(Pressable);
        const continueButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Continuar',
        );

        expect(continueButton).toBeTruthy();
        expect(continueButton!.props.disabled).toBe(false);

        act(() => {
            renderer.unmount();
        });
    });

    it('calls onContinue when continue button is pressed with date selected', () => {
        const onContinue = vi.fn();
        const renderer = render(
            <DateOfBirthStep
                value={new Date(2000, 0, 15)}
                onChange={() => undefined}
                onContinue={onContinue}
                error={null}
                loading={false}
            />,
        );

        const pressables = renderer.root.findAllByType(Pressable);
        const continueButton = pressables.find(
            (p) => p.props.accessibilityLabel === 'Continuar',
        );

        act(() => {
            continueButton!.props.onPress();
        });

        expect(onContinue).toHaveBeenCalledTimes(1);

        act(() => {
            renderer.unmount();
        });
    });

    it('renders title and subtitle text', () => {
        const renderer = render(
            <DateOfBirthStep
                value={null}
                onChange={() => undefined}
                onContinue={() => undefined}
                error={null}
                loading={false}
            />,
        );

        const texts = getTextContents(renderer);
        expect(texts).toContain('Data de nascimento');
        expect(texts).toContain(
            'Precisamos dessa informação para personalizar sua experiência.',
        );

        act(() => {
            renderer.unmount();
        });
    });
});
