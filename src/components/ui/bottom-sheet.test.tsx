import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { describe, expect, it, vi } from 'vitest';
import { Text } from 'react-native';
import { BottomSheetModal, BottomSheetOverlay } from './bottom-sheet';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

describe('BottomSheet', () => {
  it('uses the same close action for the outside area and the top handle', () => {
    const onClose = vi.fn();
    const renderer = render(
      <BottomSheetModal visible onClose={onClose} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    const closeTargets = renderer.root.findAll(
      (node) => node.type === 'Pressable' && node.props.accessibilityLabel === 'Fechar teste',
    );

    expect(closeTargets.length).toBe(2);
    act(() => {
      closeTargets[0].props.onPress();
      closeTargets[1].props.onPress();
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not render inline overlay content when hidden', () => {
    const renderer = render(
      <BottomSheetOverlay visible={false} onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo oculto</Text>
      </BottomSheetOverlay>,
    );

    expect(renderer.root.findAllByType('Text').length).toBe(0);
  });
});
