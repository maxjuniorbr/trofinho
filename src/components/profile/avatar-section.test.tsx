import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { gradients, heroPalette, lightColors } from '@/constants/theme';

import { AvatarSection } from './avatar-section';

const updateAvatarMock = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: vi.fn(),
}));

vi.mock('@/hooks/queries', () => ({
  useUpdateUserAvatar: () => updateAvatarMock,
}));

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

vi.mock('@/components/ui/inline-message', () => ({
  InlineMessage: (props: Record<string, unknown>) => React.createElement('InlineMessage', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

function flattenStyle(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

function textContent(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((value) => typeof value === 'string')
    .join(' ');
}

describe('AvatarSection', () => {
  beforeEach(() => {
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockReset();
    updateAvatarMock.mutateAsync.mockReset();
    updateAvatarMock.isPending = false;
  });

  it('renders the user block with the navy gradient, email, and compact avatar', () => {
    const renderer = render(
      <AvatarSection
        name="Família Silva"
        email="pais@silva.com"
        avatarUri="https://example.com/avatar.png"
        onAvatarChange={() => undefined}
      />,
    );

    const gradient = renderer.root.findByType('LinearGradient' as never);
    const pressable = renderer.root.findByType(Pressable);
    const avatar = renderer.root.findByType('Avatar' as never);
    const cameraButton = pressable.findByType(View);

    expect(gradient.props.colors).toEqual(gradients.heroNavy.colors);
    expect(textContent(renderer)).toContain('Família Silva');
    expect(textContent(renderer)).toContain('pais@silva.com');
    expect(avatar.props.size).toBe(56);
    expect(avatar.props.solidColor).toBe('rgba(255, 255, 255, 0.15)');
    expect(avatar.props.imageUri).toBe('https://example.com/avatar.png');
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Alterar foto de perfil');
    expect(flattenStyle(cameraButton.props.style).backgroundColor).toBe(
      lightColors.accent.adminDim,
    );
  });

  it('uses the child accent and hides the email row when email is not provided', () => {
    const renderer = render(
      <AvatarSection name="João" avatarUri={null} role="filho" onAvatarChange={() => undefined} />,
    );

    const pressable = renderer.root.findByType(Pressable);
    const cameraButton = pressable.findByType(View);

    expect(textContent(renderer)).toBe('João');
    expect(flattenStyle(cameraButton.props.style).backgroundColor).toBe(
      lightColors.accent.filhoDim,
    );
  });

  it('updates the avatar when the user selects a new image', async () => {
    const onAvatarChange = vi.fn();
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/avatar.jpg' }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    updateAvatarMock.mutateAsync.mockResolvedValue('https://example.com/new-avatar.jpg');

    const renderer = render(
      <AvatarSection name="João" avatarUri={null} onAvatarChange={onAvatarChange} />,
    );

    await act(async () => {
      await renderer.root.findByType(Pressable).props.onPress();
    });

    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    expect(updateAvatarMock.mutateAsync).toHaveBeenCalledWith('file:///tmp/avatar.jpg');
    expect(onAvatarChange).toHaveBeenCalledWith('https://example.com/new-avatar.jpg');
  });

  it('shows pending and error states inside the user block', async () => {
    updateAvatarMock.isPending = true;
    const pendingRenderer = render(
      <AvatarSection name="João" avatarUri={null} onAvatarChange={() => undefined} />,
    );

    expect(pendingRenderer.root.findByType(Pressable).props.disabled).toBe(true);
    expect(pendingRenderer.root.findByType(ActivityIndicator).props.color).toBe(
      heroPalette.textOnNavy,
    );

    updateAvatarMock.isPending = false;
    vi.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/avatar.jpg' }],
    } as Awaited<ReturnType<typeof ImagePicker.launchImageLibraryAsync>>);
    updateAvatarMock.mutateAsync.mockRejectedValue(new Error('Falha no upload.'));

    const errorRenderer = render(
      <AvatarSection name="João" avatarUri={null} onAvatarChange={() => undefined} />,
    );

    await act(async () => {
      await errorRenderer.root.findByType(Pressable).props.onPress();
    });

    const message = errorRenderer.root.findByType('InlineMessage' as never);
    expect(message.props.variant).toBe('error');
    expect(message.props.message).toBe('Falha no upload.');
  });
});
