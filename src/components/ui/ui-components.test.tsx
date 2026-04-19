import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { lightColors } from '@/constants/theme';

import { Avatar } from './avatar';
import { Badge } from './badge';
import { Button } from './button';
import { Card } from './card';
import { EmptyState } from './empty-state';
import { Input } from './input';
import { PointsDisplay } from './points-display';
import { HeaderIconButton, ScreenHeader } from './screen-header';

const routerMock = vi.hoisted(() => ({
  canGoBack: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => routerMock,
}));

function flattenStyle(style: unknown): Record<string, any> {
  return StyleSheet.flatten(style) as Record<string, any>;
}

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

describe('ui components', () => {
  beforeEach(() => {
    routerMock.canGoBack.mockReset();
    routerMock.replace.mockReset();
  });

  it('renders avatar initials, supports solid colors, and falls back when the image fails', async () => {
    const initialsRenderer = render(<Avatar name="Maria Silva" />);
    expect(initialsRenderer.root.findByType(Text).props.children).toBe('MS');

    const solidRenderer = render(<Avatar name="Joao Pedro" solidColor="#123456" />);
    const solidGradient = solidRenderer.root.findAll(
      (node) =>
        Array.isArray(node.props.colors) &&
        node.props.colors[0] === '#123456' &&
        node.props.colors[1] === '#123456',
    )[0];
    expect(solidGradient.props.colors).toEqual(['#123456', '#123456']);

    const imageRenderer = render(
      <Avatar name="Ana Beatriz" imageUri="https://img.example.com/avatar.jpg" />,
    );
    const image = imageRenderer.root.findByType(Image);

    expect(image.props.accessibilityLabel).toBe('Ana Beatriz');

    await act(async () => {
      image.props.onError();
    });

    expect(imageRenderer.root.findByType(Text).props.children).toBe('AB');
  });

  it.each([
    ['approved', lightColors.semantic.successBg, lightColors.semantic.successText],
    ['rejected', lightColors.semantic.errorBg, lightColors.semantic.errorText],
    ['pending', lightColors.semantic.warningBg, lightColors.semantic.warningText],
    ['info', lightColors.semantic.infoBg, lightColors.semantic.infoText],
    ['active', lightColors.brand.subtle, lightColors.brand.vivid],
    ['inactive', lightColors.bg.muted, lightColors.text.secondary],
  ] as const)('renders badge variant %s with the expected semantic colors', (variant, bg, fg) => {
    const renderer = render(<Badge label="Status" variant={variant} size="md" />);
    const views = renderer.root.findAllByType(View);
    const outerView = views[0];
    const label = renderer.root.findByType(Text);

    expect(flattenStyle(outerView.props.style).backgroundColor).toBe(bg);
    expect(flattenStyle(label.props.style).color).toBe(fg);
  });

  it('renders primary and secondary buttons and handles press feedback correctly', async () => {
    const onPrimaryPress = vi.fn();
    const primaryRenderer = render(<Button label="Salvar" onPress={onPrimaryPress} />);
    const primaryPressable = primaryRenderer.root.findByType(Pressable);

    await act(async () => {
      await primaryPressable.props.onPress({ type: 'press' });
    });

    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(onPrimaryPress).toHaveBeenCalled();
    const primaryGradient = primaryRenderer.root.findAll((node) =>
      Array.isArray(node.props.colors),
    )[0];
    expect(primaryGradient.props.colors).toBeTruthy();

    const secondaryRenderer = render(
      <Button label="Carregando" variant="secondary" loading size="lg" />,
    );
    const secondaryPressable = secondaryRenderer.root.findByType(Pressable);
    const secondaryStyle = flattenStyle(secondaryPressable.props.style({ pressed: true }));

    expect(secondaryPressable.props.disabled).toBe(true);
    expect(secondaryStyle.borderWidth).toBe(1);
    expect(secondaryStyle.opacity).toBe(0.45);
    expect(secondaryRenderer.root.findByType(ActivityIndicator).props.color).toBe(
      lightColors.text.primary,
    );
  });

  it('computes button styles for outline, danger, ghost, and small sizes', () => {
    const outlineRenderer = render(<Button label="Editar" variant="outline" size="sm" />);
    const outlinePressable = outlineRenderer.root.findByType(Pressable);
    const outlineStyle = flattenStyle(outlinePressable.props.style({ pressed: true }));

    expect(outlineStyle.borderColor).toBe(lightColors.brand.vivid + '4d');
    expect(outlineStyle.opacity).toBe(0.8);

    const dangerRenderer = render(<Button label="Excluir" variant="danger" />);
    const dangerStyle = flattenStyle(
      dangerRenderer.root.findByType(Pressable).props.style({ pressed: false }),
    );
    expect(dangerStyle.backgroundColor).toBe(lightColors.semantic.errorBg);

    const ghostRenderer = render(<Button label="Cancelar" variant="ghost" />);
    const ghostText = ghostRenderer.root.findByType(Text);
    expect(flattenStyle(ghostText.props.style).color).toBe(lightColors.text.secondary);
  });

  it('renders cards with default, elevated, glow, and no-padding modes', () => {
    const defaultRenderer = render(
      <Card>
        <Text>Conteudo</Text>
      </Card>,
    );
    expect(flattenStyle(defaultRenderer.root.findByType(View).props.style).padding).toBeGreaterThan(
      0,
    );

    const elevatedRenderer = render(<Card elevated />);
    expect(
      flattenStyle(elevatedRenderer.root.findByType(View).props.style).shadowOpacity,
    ).toBeDefined();

    const glowRenderer = render(<Card glow noPadding />);
    const glowStyle = flattenStyle(glowRenderer.root.findByType(View).props.style);

    expect(glowStyle.borderColor).toBe(lightColors.brand.vivid + '33');
    expect(glowStyle.padding).toBe(0);
  });

  it('handles empty state loading, error, empty, retry, and null branches', async () => {
    const loadingRenderer = render(<EmptyState loading />);
    expect(loadingRenderer.root.findByType(ActivityIndicator).props.color).toBe(
      lightColors.brand.vivid,
    );

    const onRetry = vi.fn();
    const errorRenderer = render(<EmptyState error="Falhou" onRetry={onRetry} />);
    const retryButton = errorRenderer.root.findByType(Pressable);

    await act(async () => {
      retryButton.props.onPress();
    });

    expect(onRetry).toHaveBeenCalled();
    expect(
      errorRenderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .join(' '),
    ).toContain('Algo deu errado');

    // Error state uses AlertTriangle icon instead of emoji
    const alertIcon = errorRenderer.root.findAll((node) => String(node.type) === 'AlertTriangle');
    expect(alertIcon.length).toBe(1);

    const emptyRenderer = render(
      <EmptyState empty emptyTitle="Sem tarefas" emptyMessage="Nada por aqui" />,
    );
    expect(
      emptyRenderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .join(' '),
    ).toContain('Sem tarefas');

    // Empty state uses mascot image instead of emoji
    const mascotImage = emptyRenderer.root.findByType(Image);
    expect(mascotImage.props.accessibilityLabel).toContain('Trofinho');

    const nullRenderer = render(<EmptyState />);
    expect(nullRenderer.toJSON()).toBeNull();
  });

  it('renders inputs with labels and error messages', () => {
    const renderer = render(
      <Input label="Nome" value="Lia" onChangeText={() => undefined} error="Obrigatorio" />,
    );

    const nodes = renderer.root.findAllByType(Text);
    const input = renderer.root.findByType(TextInput);

    expect(nodes.map((node) => node.props.children)).toEqual(['Nome', 'Obrigatorio']);
    expect(flattenStyle(input.props.style).borderColor).toBe(lightColors.border.error);
  });

  it('formats point values with the correct visual variant and size', () => {
    const goldRenderer = render(<PointsDisplay value={1250} label="Saldo" />);
    const goldTexts = goldRenderer.root.findAllByType(Text);

    expect(goldTexts[0].props.children).toBe('1.250');
    expect(flattenStyle(goldTexts[0].props.style).color).toBe(lightColors.brand.vivid);

    const amberRenderer = render(
      <PointsDisplay value={30} label="Bonus" variant="amber" size="lg" />,
    );
    const amberTexts = amberRenderer.root.findAllByType(Text);
    expect(flattenStyle(amberTexts[0].props.style).color).toBe(lightColors.brand.dim);

    const defaultRenderer = render(<PointsDisplay value={4} label="Meta" variant="default" />);
    const defaultTexts = defaultRenderer.root.findAllByType(Text);
    expect(flattenStyle(defaultTexts[0].props.style).color).toBe(lightColors.text.primary);
  });

  it('uses the back callback when navigation can go back', async () => {
    routerMock.canGoBack.mockReturnValue(true);
    const onBack = vi.fn();
    const renderer = render(<ScreenHeader title="Perfil" onBack={onBack} />);
    const backButton = renderer.root.findByType(Pressable);
    const title = renderer.root
      .findAllByType(Text)
      .find((node) => node.props.children === 'Perfil')!;

    await act(async () => {
      backButton.props.onPress();
    });

    expect(onBack).toHaveBeenCalled();
    expect(routerMock.replace).not.toHaveBeenCalled();
    expect(backButton.props.accessibilityLabel).toBe('Voltar para Voltar');
    expect(flattenStyle(backButton.props.style({ pressed: false })).backgroundColor).toBe(
      lightColors.bg.muted,
    );
    expect(flattenStyle(backButton.props.style({ pressed: false })).width).toBe(40);
    expect(flattenStyle(title.props.style).textAlign).toBe('left');
  });

  it('falls back to route replacement when the stack cannot go back', async () => {
    routerMock.canGoBack.mockReturnValue(false);

    const childRenderer = render(
      <ScreenHeader
        title="Tarefa"
        onBack={() => undefined}
        role="filho"
        rightAction={<Text>Acao</Text>}
      />,
    );
    const childBackButton = childRenderer.root.findByType(Pressable);

    await act(async () => {
      childBackButton.props.onPress();
    });

    expect(routerMock.replace).toHaveBeenCalledWith('/(child)/');
    expect(flattenStyle(childBackButton.props.style({ pressed: false })).backgroundColor).toBe(
      lightColors.bg.muted,
    );
    expect(
      childRenderer.root
        .findAllByType(Text)
        .map((node) => node.props.children)
        .join(' '),
    ).toContain('Acao');

    const adminRenderer = render(
      <ScreenHeader title="Admin" onBack={() => undefined} role="admin" />,
    );
    await act(async () => {
      adminRenderer.root.findByType(Pressable).props.onPress();
    });

    expect(routerMock.replace).toHaveBeenCalledWith('/(admin)/');

    const withoutBack = render(<ScreenHeader title="Sem voltar" />);
    expect(withoutBack.root.findAllByType(Pressable)).toHaveLength(0);
  });

  it('renders header icon buttons with the same visual treatment as the back button', () => {
    const onPress = vi.fn();
    const renderer = render(
      <HeaderIconButton icon={Plus} onPress={onPress} accessibilityLabel="Criar item" />,
    );

    const button = renderer.root.findByType(Pressable);
    const style = flattenStyle(button.props.style({ pressed: false }));
    const pressedStyle = flattenStyle(button.props.style({ pressed: true }));

    expect(style.backgroundColor).toBe(lightColors.bg.muted);
    expect(style.width).toBe(40);
    expect(style.height).toBe(40);
    expect(pressedStyle.transform).toEqual([{ scale: 0.95 }]);
  });

  it('supports accent header icon buttons when explicitly requested', () => {
    const renderer = render(
      <HeaderIconButton
        icon={Plus}
        onPress={() => undefined}
        accessibilityLabel="Acao"
        tone="accent"
        role="filho"
      />,
    );

    const style = flattenStyle(renderer.root.findByType(Pressable).props.style({ pressed: false }));
    expect(style.backgroundColor).toBe(lightColors.accent.filho);
  });
});
