// Feature: ux-polish-fase4a, Property 1: loadingLabel é exibido quando loading=true
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';

import { Button } from './button';

describe('Button — loadingLabel property', () => {
  // **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
  it('P1: when loading=true, rendered text matches loadingLabel (not the regular label)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (loadingLabel) => {
        let renderer!: ReturnType<typeof create>;

        act(() => {
          renderer = create(<Button label="Regular label" loading loadingLabel={loadingLabel} />);
        });

        const texts = renderer.root.findAllByType(Text).map((node) => node.props.children);

        expect(texts).toContain(loadingLabel);
        expect(texts).not.toContain('Regular label');
      }),
      { numRuns: 100 },
    );
  });
});
