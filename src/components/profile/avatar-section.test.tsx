import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';
import { gradients, heroPalette } from '@/constants/theme';

import { AvatarSection } from './avatar-section';

vi.mock('@/components/ui/avatar', () => ({
  Avatar: (props: Record<string, unknown>) => React.createElement('Avatar', props),
}));

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

function textContent(renderer: ReactTestRenderer): string {
  return renderer.root
    .findAllByType(Text)
    .map((node) => node.props.children)
    .filter((value) => typeof value === 'string')
    .join(' ');
}

describe('AvatarSection', () => {
  it('renders the user block with the navy gradient, email, and avatar', () => {
    const renderer = render(
      <AvatarSection
        name="Família Silva"
        email="pais@silva.com"
        avatarUri="https://example.com/avatar.png"
      />,
    );

    const gradient = renderer.root.findByType('LinearGradient' as never);
    const avatar = renderer.root.findByType('Avatar' as never);

    expect(gradient.props.colors).toEqual(gradients.heroNavy.colors);
    expect(textContent(renderer)).toContain('Família Silva');
    expect(textContent(renderer)).toContain('pais@silva.com');
    expect(avatar.props.size).toBe(56);
    expect(avatar.props.solidColor).toBe(heroPalette.borderSoft);
    expect(avatar.props.imageUri).toBe('https://example.com/avatar.png');
  });

  it('hides the email row when email is not provided', () => {
    const renderer = render(<AvatarSection name="João" avatarUri={null} />);

    expect(textContent(renderer)).toBe('João');
  });

  it('passes a null avatar to the Avatar component when no avatarUri is provided', () => {
    const renderer = render(<AvatarSection name="João" avatarUri={null} />);

    const avatar = renderer.root.findByType('Avatar' as never);
    expect(avatar.props.imageUri).toBeNull();
  });
});
