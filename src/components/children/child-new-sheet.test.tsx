import React from 'react';
import { TextInput } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { ChildNewSheet } from './child-new-sheet';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

describe('ChildNewSheet', () => {
  it('focuses the name field when opening a new child registration', () => {
    const renderer = render(<ChildNewSheet visible onClose={vi.fn()} />);

    const inputs = renderer.root.findAllByType(TextInput);

    expect(inputs[0].props.accessibilityLabel).toBe('Nome do filho');
    expect(inputs[0].props.autoFocus).toBe(true);
  });
});
