// Feature: ux-polish-fase4a, Property 3: RouteErrorFallback reporta qualquer erro ao Sentry
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

const captureExceptionMock = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react-native', () => ({
  captureException: captureExceptionMock,
}));

import { ErrorBoundary } from './route-error-fallback';

describe('RouteErrorFallback', () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
  });

  // **Validates: Requirements 3.6**
  it('P3: for any Error, captureException is called exactly once with that error on mount', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        captureExceptionMock.mockReset();
        const error = new Error(message);
        const retry = vi.fn();

        act(() => {
          create(<ErrorBoundary error={error} retry={retry} />);
        });

        expect(captureExceptionMock).toHaveBeenCalledTimes(1);
        expect(captureExceptionMock).toHaveBeenCalledWith(error);
      }),
      { numRuns: 100 },
    );
  });

  // **Validates: Requirements 3.3, 3.4**
  it('renders error message "Algo deu errado." and "Voltar ao início" button', () => {
    const error = new Error('test error');
    const retry = vi.fn();
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(<ErrorBoundary error={error} retry={retry} />);
    });

    const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);
    expect(texts).toContain('Algo deu errado.');
    expect(texts).toContain('Voltar ao início');
  });

  // **Validates: Requirements 3.5**
  it('calls retry() when "Voltar ao início" button is pressed', () => {
    const error = new Error('test error');
    const retry = vi.fn();
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(<ErrorBoundary error={error} retry={retry} />);
    });

    const button = renderer.root.findByType(Pressable);

    act(() => {
      button.props.onPress();
    });

    expect(retry).toHaveBeenCalledTimes(1);
  });

  // **Validates: Requirements 3.7**
  it('has accessibilityLabel="Voltar ao início" on the button', () => {
    const error = new Error('test error');
    const retry = vi.fn();
    let renderer!: ReactTestRenderer;

    act(() => {
      renderer = create(<ErrorBoundary error={error} retry={retry} />);
    });

    const button = renderer.root.findByType(Pressable);
    expect(button.props.accessibilityLabel).toBe('Voltar ao início');
  });
});
