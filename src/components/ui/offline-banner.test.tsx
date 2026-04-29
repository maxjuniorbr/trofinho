import React from 'react';
import { act, create, type ReactTestRenderer } from '../../../test/helpers/test-renderer-compat';
import { Text } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

const networkStatusMock = vi.hoisted(() => ({ isOnline: true }));

vi.mock('@/hooks/use-network-status', () => ({
    useNetworkStatus: () => networkStatusMock,
}));

import { OfflineBanner } from './offline-banner';

function render(element: React.ReactElement) {
    let renderer!: ReactTestRenderer;
    act(() => {
        renderer = create(element);
    });
    return renderer;
}

describe('OfflineBanner', () => {
    it('renders the offline message text', () => {
        networkStatusMock.isOnline = false;
        const renderer = render(<OfflineBanner />);
        const texts = renderer.root.findAllByType(Text);
        const labels = texts.map((t) => t.props.children).flat();
        expect(labels).toContain('Sem conexão com a internet');
    });

    it('renders when online (banner slides out of view)', () => {
        networkStatusMock.isOnline = true;
        const renderer = render(<OfflineBanner />);
        expect(renderer.toJSON()).not.toBeNull();
    });

    it('has correct accessibility label', () => {
        networkStatusMock.isOnline = false;
        const renderer = render(<OfflineBanner />);
        const json = renderer.toJSON() as { props?: { accessibilityLabel?: string } };
        expect(json?.props?.accessibilityLabel).toBe('Sem conexão com a internet');
    });
});
