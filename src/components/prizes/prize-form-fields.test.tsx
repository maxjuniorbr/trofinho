import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text, TextInput } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { lightColors } from '@/constants/theme';
import { PrizeFormFields } from './prize-form-fields';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

describe('prize form fields', () => {
  it('renders all fields and wires their change handlers', async () => {
    const onNameChange = vi.fn();
    const onDescriptionChange = vi.fn();
    const onCostChange = vi.fn();

    const renderer = render(
      <PrizeFormFields
        name="Sorvete"
        description="Chocolate"
        cost="50"
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onCostChange={onCostChange}
        autoFocusName
      />
    );

    const texts = renderer.root.findAllByType(Text);
    const inputs = renderer.root.findAllByType(TextInput);

    expect(texts.map((node) => node.props.children)).toEqual([
      'Nome *',
      'Descrição',
      'Custo em pontos *',
    ]);
    expect(inputs[0].props.autoFocus).toBe(true);
    expect(StyleSheet.flatten(inputs[0].props.style).backgroundColor).toBe(lightColors.bg.surface);

    await act(async () => {
      inputs[0].props.onChangeText('Filme');
      inputs[1].props.onChangeText('No cinema');
      inputs[2].props.onChangeText('80');
    });

    expect(onNameChange).toHaveBeenCalledWith('Filme');
    expect(onDescriptionChange).toHaveBeenCalledWith('No cinema');
    expect(onCostChange).toHaveBeenCalledWith('80');
  });

  it('enforces maxLength on name, description, and cost inputs', () => {
    const renderer = render(
      <PrizeFormFields
        name=""
        description=""
        cost=""
        onNameChange={vi.fn()}
        onDescriptionChange={vi.fn()}
        onCostChange={vi.fn()}
      />
    );

    const inputs = renderer.root.findAllByType(TextInput);

    expect(inputs[0].props.maxLength).toBe(100);   // name
    expect(inputs[1].props.maxLength).toBe(500);   // description
    expect(inputs[2].props.maxLength).toBe(7);     // cost
  });
});
