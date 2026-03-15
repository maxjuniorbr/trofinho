import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('expo-router', () => ({
  Redirect: (props: Record<string, unknown>) => {
    redirectMock(props);
    return React.createElement('Redirect', props);
  },
}));

import Index from '../../app/index';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

describe('app index', () => {
  it('redirects directly to the login route', () => {
    const renderer = render(<Index />);

    expect(redirectMock).toHaveBeenCalledWith({ href: '/(auth)/login' });
    expect(renderer.root.findByProps({ href: '/(auth)/login' }).props.href).toBe('/(auth)/login');
  });
});
