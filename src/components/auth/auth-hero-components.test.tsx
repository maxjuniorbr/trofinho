import React from 'react';
import { Pressable, StyleSheet, Text, TextInput } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';

import { AuthDarkField, DarkPasswordToggle } from './auth-dark-field';
import { AuthHeroScreen } from './auth-hero-screen';
import { BrandLogo } from './brand-logo';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(element);
  });
  return renderer;
}

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

describe('BrandLogo', () => {
  it('renders the gold "T" tile only by default', () => {
    const renderer = render(<BrandLogo />);
    const texts = renderer.root.findAllByType(Text);
    expect(texts.map((node) => node.props.children)).toEqual(['T']);
  });

  it('renders the brand text alongside the tile when withText is set', () => {
    const renderer = render(<BrandLogo size="lg" withText variant="onDark" />);
    const texts = renderer.root.findAllByType(Text).map((n) => n.props.children);
    expect(texts).toContain('Trofinho');
  });
});

describe('AuthDarkField', () => {
  it('switches background and border when focused', () => {
    const focused = render(
      <AuthDarkField label="E-mail" focused value="" onChangeText={() => undefined} />,
    );
    const focusedRow = focused.root.findByType(TextInput).parent!;
    const focusedStyle = flatten(focusedRow.props.style);
    // Focused border uses the active palette's `borderFocus` (gold variants:
    // `#FAC114` in dark mode, `#C57B0D` in light mode). Either is valid; the
    // contract is that it differs from the blurred border.
    expect(focusedStyle.borderColor).toMatch(/^#(FAC114|C57B0D)$/i);

    const blurred = render(
      <AuthDarkField label="Senha" focused={false} value="" onChangeText={() => undefined} />,
    );
    const blurredRow = blurred.root.findByType(TextInput).parent!;
    expect(flatten(blurredRow.props.style).borderColor).not.toBe(focusedStyle.borderColor);
  });

  it('toggles password visibility through DarkPasswordToggle', () => {
    const onToggle = vi.fn();
    const renderer = render(<DarkPasswordToggle visible={false} onToggle={onToggle} />);
    const pressable = renderer.root.findByType(Pressable);
    expect(pressable.props.accessibilityLabel).toBe('Mostrar senha');

    act(() => {
      pressable.props.onPress();
    });
    expect(onToggle).toHaveBeenCalledTimes(1);

    const visibleRenderer = render(<DarkPasswordToggle visible onToggle={onToggle} />);
    expect(visibleRenderer.root.findByType(Pressable).props.accessibilityLabel).toBe(
      'Ocultar senha',
    );
  });
});

describe('AuthHeroScreen', () => {
  it('renders the body content without a top bar by default', () => {
    const renderer = render(
      <AuthHeroScreen>
        <Text>Conteudo</Text>
      </AuthHeroScreen>,
    );
    const texts = renderer.root.findAllByType(Text).map((n) => n.props.children);
    expect(texts).toEqual(['Conteudo']);
    expect(renderer.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('renders the back chip and invokes onBack when pressed', () => {
    const onBack = vi.fn();
    const renderer = render(
      <AuthHeroScreen
        onBack={onBack}
        backAccessibilityLabel="Voltar para o login"
        topBarCenter={<Text>Logo</Text>}
        topBarRight={<Text>Slot</Text>}
      >
        <Text>Body</Text>
      </AuthHeroScreen>,
    );

    const backButton = renderer.root
      .findAllByType(Pressable)
      .find((node) => node.props.accessibilityLabel === 'Voltar para o login');
    expect(backButton).toBeTruthy();

    act(() => {
      backButton!.props.onPress();
    });
    expect(onBack).toHaveBeenCalledTimes(1);

    const pressedStyle = backButton!.props.style({ pressed: true });
    expect(pressedStyle[1].opacity).toBe(0.7);
  });
});
