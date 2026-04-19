import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { describe, expect, it, vi } from 'vitest';
import { WeekdaySelector } from './weekday-selector';

const WEEKDAY_ACCESSIBILITY_LABELS = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

describe('WeekdaySelector', () => {
  it('renders repeated short labels without duplicate React keys', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const renderer = render(<WeekdaySelector value={0} onChange={vi.fn()} />);

    const duplicateKeyWarnings = consoleErrorSpy.mock.calls.filter(([message]) =>
      String(message).includes('Encountered two children with the same key'),
    );
    const buttons = renderer.root.findAll((node) => node.type === 'Pressable');

    expect(duplicateKeyWarnings).toHaveLength(0);
    expect(buttons.map((button) => button.props.accessibilityLabel)).toEqual(
      WEEKDAY_ACCESSIBILITY_LABELS,
    );
  });

  it('uses the day index when toggling a repeated label', () => {
    const onChange = vi.fn();
    const renderer = render(<WeekdaySelector value={0} onChange={onChange} />);
    const buttons = renderer.root.findAll((node) => node.type === 'Pressable');

    act(() => {
      buttons[4].props.onPress();
    });

    expect(buttons[4].props.accessibilityLabel).toBe('Quinta-feira');
    expect(onChange).toHaveBeenCalledWith(16);
  });
});
