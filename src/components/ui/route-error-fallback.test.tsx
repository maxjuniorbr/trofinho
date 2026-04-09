// Feature: ux-polish-fase4a, Property 3: RouteErrorFallback logs errors via console.error
import React from 'react';
import {act, create, type ReactTestRenderer} from '../../../test/helpers/test-renderer-compat';
import { Pressable, Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fc from 'fast-check';

import { ErrorBoundary } from './route-error-fallback';

describe('RouteErrorFallback', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // **Validates: Requirements 3.6**
  it('P3: for any Error, console.error is called with that error on mount', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (message) => {
        consoleErrorSpy.mockClear();
        const error = new Error(message);
        const retry = vi.fn();

        act(() => {
          create(<ErrorBoundary error={error} retry={retry} />);
        });

        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      }),
      { numRuns: 100 },
    );
    consoleErrorSpy.mockRestore();
  });

  // **Validates: Requirements 3.3, 3.4**
  it('renders error message "Algo deu errado." and "Voltar ao início" button', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
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
