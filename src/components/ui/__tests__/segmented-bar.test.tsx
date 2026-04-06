import React from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { SegmentedBar, type SegmentOption } from '../segmented-bar';

type Filter = 'a' | 'b' | 'c';

const OPTIONS: SegmentOption<Filter>[] = [
  { key: 'a', label: 'Alpha', badge: 3 },
  { key: 'b', label: 'Beta', badge: 0 },
  { key: 'c', label: 'Gamma' },
];

function renderBar(value: Filter = 'a', options = OPTIONS) {
  const onChange = vi.fn();
  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(<SegmentedBar options={options} value={value} onChange={onChange} role="filho" />);
  });
  return { root, onChange };
}

describe('SegmentedBar badges', () => {
  it('renders badge text when badge > 0', () => {
    const { root } = renderBar();
    const json = JSON.stringify(root.toJSON());
    expect(json).toContain('"children":["3"]');
  });

  it('does not render badge when badge is 0', () => {
    const { root } = renderBar('b');
    const pressables = root.root.findAll((node) => (node.type as string) === 'Pressable');
    const betaPill = pressables[1];
    // Badge Views have minWidth: 18. Should be none inside the Beta pill.
    const badgeViews = betaPill.findAll(
      (node) =>
        (node.type as string) === 'View' &&
        node.props?.style?.minWidth === 18,
    );
    expect(badgeViews).toHaveLength(0);
  });

  it('does not render badge when badge is undefined', () => {
    const { root } = renderBar('c');
    const pressables = root.root.findAll((node) => (node.type as string) === 'Pressable');
    const gammaPill = pressables[2];
    const badgeViews = gammaPill.findAll(
      (node) =>
        (node.type as string) === 'View' &&
        node.props?.style?.minWidth === 18,
    );
    expect(badgeViews).toHaveLength(0);
  });

  it('includes badge count in accessibilityLabel when badge > 0', () => {
    const { root } = renderBar();
    const pressables = root.root.findAll((node) => (node.type as string) === 'Pressable');
    expect(pressables[0].props.accessibilityLabel).toBe('Alpha (3)');
    expect(pressables[1].props.accessibilityLabel).toBe('Beta');
    expect(pressables[2].props.accessibilityLabel).toBe('Gamma');
  });

  it('caps badge text at 99+', () => {
    const options: SegmentOption<Filter>[] = [
      { key: 'a', label: 'Alpha', badge: 150 },
      { key: 'b', label: 'Beta' },
      { key: 'c', label: 'Gamma' },
    ];
    const { root } = renderBar('a', options);
    const json = JSON.stringify(root.toJSON());
    expect(json).toContain('"children":["99+"]');
  });

  it('calls onChange with the key when a segment is pressed', () => {
    const { root, onChange } = renderBar('a');
    const pressables = root.root.findAll((node) => (node.type as string) === 'Pressable');
    act(() => {
      pressables[1].props.onPress();
    });
    expect(onChange).toHaveBeenCalledWith('b');
  });
});
