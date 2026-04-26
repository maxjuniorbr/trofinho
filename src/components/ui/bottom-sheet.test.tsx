import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { describe, expect, it, vi } from 'vitest';
import { Keyboard, Text } from 'react-native';
import { BottomSheetModal, BottomSheetOverlay } from './bottom-sheet';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

describe('BottomSheet', () => {
  it('runs the onShow callback after the native modal is presented', () => {
    const onShow = vi.fn();
    const renderer = render(
      <BottomSheetModal visible onShow={onShow} onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    const [modal] = renderer.root.findAll((node) => node.type === 'Modal');
    act(() => {
      modal.props.onShow();
    });

    expect(onShow).toHaveBeenCalledTimes(1);
  });

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

  it('subscribes to keyboard events and cleans up on unmount', () => {
    const removeSpy = vi.fn();
    vi.mocked(Keyboard.addListener).mockReturnValue({ remove: removeSpy } as never);

    const renderer = render(
      <BottomSheetModal visible onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    expect(Keyboard.addListener).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));

    act(() => {
      renderer.unmount();
    });

    expect(removeSpy).toHaveBeenCalledTimes(2);
  });

  it('renders overlay content when visible', () => {
    const renderer = render(
      <BottomSheetOverlay visible onClose={vi.fn()} closeLabel="Fechar overlay">
        <Text>Conteúdo visível</Text>
      </BottomSheetOverlay>,
    );

    const texts = renderer.root.findAllByType('Text');
    const contentText = texts.find((t) => t.props.children === 'Conteúdo visível');
    expect(contentText).toBeDefined();
  });
});
