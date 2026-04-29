import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../../test/helpers/test-renderer-compat';
import { describe, expect, it } from 'vitest';

import { ListFooter } from '../list-footer';

describe('ListFooter', () => {
    it('returns null when loading=false', () => {
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(<ListFooter loading={false} />);
        });

        expect(renderer.toJSON()).toBeNull();
    });

    it('renders ActivityIndicator when loading=true', () => {
        let renderer!: ReactTestRenderer;
        act(() => {
            renderer = create(<ListFooter loading={true} />);
        });

        const indicators = renderer.root.findAll((node) => node.type === 'ActivityIndicator');
        expect(indicators.length).toBe(1);
    });
});
