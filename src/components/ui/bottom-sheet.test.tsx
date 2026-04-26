import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Keyboard, Platform, Text } from 'react-native';
import { BottomSheetModal, BottomSheetOverlay } from './bottom-sheet';

const initialPlatformOS = Platform.OS;

function setPlatformOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
}

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function getKeyboardAvoidingView(renderer: ReactTestRenderer) {
  const [keyboardAvoidingView] = renderer.root.findAll(
    (node) => node.type === 'KeyboardAvoidingView',
  );

  expect(keyboardAvoidingView).toBeDefined();
  return keyboardAvoidingView;
}

afterEach(() => {
  setPlatformOS(initialPlatformOS);
});

describe('BottomSheet', () => {
  it('keeps keyboard padding enabled by default on iOS', () => {
    setPlatformOS('ios');
    const renderer = render(
      <BottomSheetModal visible onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    const keyboardAvoidingView = getKeyboardAvoidingView(renderer);
    expect(keyboardAvoidingView.props.behavior).toBe('padding');
    expect(keyboardAvoidingView.props.enabled).toBe(true);
  });

  it('does not add keyboard padding by default on Android modals', () => {
    setPlatformOS('android');
    const renderer = render(
      <BottomSheetModal visible onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    const keyboardAvoidingView = getKeyboardAvoidingView(renderer);
    expect(keyboardAvoidingView.props.behavior).toBeUndefined();
    expect(keyboardAvoidingView.props.enabled).toBe(false);
  });

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

  it('subscribes to keyboard events on Android for edge-to-edge support', () => {
    setPlatformOS('android');
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

  it('does not subscribe to keyboard events on iOS', () => {
    setPlatformOS('ios');
    vi.mocked(Keyboard.addListener).mockClear();

    render(
      <BottomSheetModal visible onClose={vi.fn()} closeLabel="Fechar teste">
        <Text>Conteúdo</Text>
      </BottomSheetModal>,
    );

    expect(Keyboard.addListener).not.toHaveBeenCalled();
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
