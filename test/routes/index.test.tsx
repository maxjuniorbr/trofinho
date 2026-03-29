import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it } from 'vitest';

import Index from '../../app/index';

function render(element: React.ReactElement) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(element);
  });

  return renderer;
}

describe('app index', () => {
  it('renders an empty View without redirecting', () => {
    const renderer = render(<Index />);

    // The index route is now a blank placeholder; the root layout
    // handles all auth-based navigation so there is no <Redirect>.
    const tree = renderer.toJSON() as { type: string };
    expect(tree.type).toBe('View');
  });
});
