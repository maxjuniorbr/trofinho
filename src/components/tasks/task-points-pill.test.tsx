import React from 'react';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { act, create } from '../../../test/helpers/test-renderer-compat';
import { gradients, staticTextColors } from '@/constants/theme';

import { TaskPointsPill } from './task-points-pill';

describe('TaskPointsPill', () => {
  it('renders task points with the shared gold gradient', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TaskPointsPill points={15} />);
    });

    const gradient = renderer.root.findByType('LinearGradient' as never);
    const text = renderer.root.findByType(Text);

    expect(gradient.props.colors).toEqual(gradients.gold.colors);
    expect(text.props.children).toEqual(['', 15, ' pts']);
    expect(text.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: staticTextColors.onBrand })]),
    );
  });

  it('supports feed-style signed point values', () => {
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<TaskPointsPill points={8} prefix="+" suffix="" />);
    });

    expect(renderer.root.findByType(Text).props.children).toEqual(['+', 8, '']);
  });
});
