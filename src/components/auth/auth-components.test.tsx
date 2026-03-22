import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
} from 'react-native';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { lightColors } from '@/constants/theme';

vi.mock('../../../assets/trofinho-mascot.png', () => ({
  default: 1,
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    canGoBack: () => true,
    replace: vi.fn(),
  }),
}));

import { Button } from '../ui/button';
import { AuthShell } from './auth-shell';
import { AuthTextField } from './auth-text-field';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

function flattenStyle(style: unknown): Record<string, any> {
  return StyleSheet.flatten(style) as Record<string, any>;
}

describe('auth components', () => {
  beforeEach(() => {
    (Animated.parallel as unknown as Mock).mockClear();
    (Animated.spring as unknown as Mock).mockClear();
    (Animated.timing as unknown as Mock).mockClear();
  });

  it('renders the primary button in idle and loading states with loadingLabel', () => {
    const onPress = vi.fn();
    const idleRenderer = render(
      <Button
        label="Entrar"
        loadingLabel="Entrando..."
        loading={false}
        onPress={onPress}
        accessibilityLabel="Entrar"
      />
    );
    const idlePressable = idleRenderer.root.findByType(Pressable);

    expect(idlePressable.props.disabled).toBe(false);
    // Primary button uses 0.82 opacity when pressed (not loading)
    expect(flattenStyle(idlePressable.props.style({ pressed: true })).opacity).toBe(0.82);
    expect(idleRenderer.root.findByType(Text).props.children).toBe('Entrar');

    const loadingRenderer = render(
      <Button
        label="Entrar"
        loadingLabel="Entrando..."
        loading
        onPress={onPress}
        accessibilityLabel="Entrando"
      />
    );
    const loadingPressable = loadingRenderer.root.findByType(Pressable);

    expect(loadingPressable.props.disabled).toBe(true);
    expect(loadingRenderer.root.findByType(ActivityIndicator).props.color).toBe(lightColors.text.onBrand);
    expect(loadingRenderer.root.findByType(Text).props.children).toBe('Entrando...');
  });

  it('renders auth text fields with focus and blur styling', () => {
    const focusedRenderer = render(
      <AuthTextField
        label="E-mail"
        focused
        value="max@example.com"
        onChangeText={() => undefined}
      />
    );
    const focusedInput = focusedRenderer.root.findByType(TextInput);
    expect(flattenStyle(focusedInput.props.style).borderColor).toBe(lightColors.border.focus);

    const defaultRenderer = render(
      <AuthTextField
        label="Senha"
        focused={false}
        value="123456"
        onChangeText={() => undefined}
      />
    );
    const defaultInput = defaultRenderer.root.findByType(TextInput);
    expect(flattenStyle(defaultInput.props.style).borderColor).toBe(lightColors.border.default);
  });

  it('renders the auth shell in hero mode and starts the entry animations', () => {
    const renderer = render(
      <AuthShell title="Trofinho" subtitle="Subtitulo" variant="hero">
        <Text>Conteudo</Text>
      </AuthShell>
    );

    expect(Animated.parallel as unknown as Mock).toHaveBeenCalledTimes(1);
    expect(Animated.spring as unknown as Mock).toHaveBeenCalledTimes(3);
    expect(Animated.timing as unknown as Mock).toHaveBeenCalledTimes(1);

    const image = renderer.root.findByType(Image);
    const texts = renderer.root.findAllByType(Text);

    expect(image.props.source).toBe(0);
    expect(flattenStyle(image.props.style).width).toBe(140);
    expect(texts.map((node) => node.props.children)).toEqual(['Trofinho', 'Subtitulo', 'Conteudo']);
  });

  it('renders the auth shell in compact mode with smaller mascot sizing', () => {
    const renderer = render(
      <AuthShell title="Login" subtitle="Acesse sua conta">
        <Text>Formulario</Text>
      </AuthShell>
    );

    const image = renderer.root.findByType(Image);
    expect(flattenStyle(image.props.style).width).toBe(100);
    expect(flattenStyle(image.props.style).height).toBe(100);
  });

  it('renders a custom muted header for compact auth screens', () => {
    const renderer = render(
      <AuthShell
        headerTitle="Criar Conta"
        onBack={() => undefined}
        backLabel="Login"
        title="Criar conta"
        subtitle="Subtitulo"
      >
        <Text>Formulario</Text>
      </AuthShell>
    );

    const buttons = renderer.root.findAllByType(Pressable);
    expect(buttons[0]?.props.accessibilityLabel).toBe('Voltar para Login');
    expect(flattenStyle(buttons[0]?.props.style({ pressed: false })).backgroundColor)
      .toBe(lightColors.bg.muted);
  });
});
