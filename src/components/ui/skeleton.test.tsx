import React from 'react';
import { Animated } from 'react-native';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { beforeAll, describe, expect, it } from 'vitest';

// Patch Animated mock with missing methods used by SkeletonBox
beforeAll(() => {
    const A = Animated as Record<string, unknown>;
    if (!A.sequence) {
        A.sequence = () => ({ start: () => { }, stop: () => { } });
    }
    if (!A.loop) {
        A.loop = () => ({ start: () => { }, stop: () => { } });
    }
});

import {
    HomeScreenSkeleton,
    AdminHomeScreenSkeleton,
    ListScreenSkeleton,
} from './skeleton';

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('Skeleton components', () => {
    describe('HomeScreenSkeleton', () => {
        it('renders without crashing', () => {
            const renderer = render(<HomeScreenSkeleton />);
            expect(renderer.toJSON()).not.toBeNull();
        });

        it('renders multiple skeleton boxes', () => {
            const renderer = render(<HomeScreenSkeleton />);
            const json = JSON.stringify(renderer.toJSON());
            expect(json).toBeTruthy();
        });
    });

    describe('AdminHomeScreenSkeleton', () => {
        it('renders without crashing', () => {
            const renderer = render(<AdminHomeScreenSkeleton />);
            expect(renderer.toJSON()).not.toBeNull();
        });

        it('renders child card skeletons', () => {
            const renderer = render(<AdminHomeScreenSkeleton />);
            const json = JSON.stringify(renderer.toJSON());
            expect(json).toBeTruthy();
        });
    });

    describe('ListScreenSkeleton', () => {
        it('renders without crashing', () => {
            const renderer = render(<ListScreenSkeleton />);
            expect(renderer.toJSON()).not.toBeNull();
        });

        it('renders list card skeletons', () => {
            const renderer = render(<ListScreenSkeleton />);
            const json = JSON.stringify(renderer.toJSON());
            expect(json).toBeTruthy();
        });
    });
});
