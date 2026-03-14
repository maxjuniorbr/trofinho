import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, typography } from '@/constants/theme';

interface AvatarProps {
  /** Full name — up to 2 initials extracted */
  name: string;
  size?: number;
  /**
   * Override gradient with a solid color instead.
   * When set, the gold gradient is replaced by this solid background.
   */
  solidColor?: string;
}

type ReadonlyAvatarProps = Readonly<AvatarProps>;

export function Avatar({ name, size = 44, solidColor }: ReadonlyAvatarProps) {
  const initials = name
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || '?';

  const fontSize = Math.round(size * 0.4);
  const borderRadius = size / 2;

  if (solidColor) {
    // Solid color fallback (e.g. per-role accent)
    return (
      <LinearGradient
        colors={[solidColor, solidColor]}
        style={[styles.base, { width: size, height: size, borderRadius }]}
      >
        <Text style={[styles.initial, { fontSize }]}>{initials}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradients.gold.colors}
      start={gradients.gold.start}
      end={gradients.gold.end}
      style={[styles.base, { width: size, height: size, borderRadius }]}
    >
      <Text style={[styles.initial, { fontSize }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: '#2a2410',  // onBrand — dark amber text on gold gradient
    fontFamily: typography.family.black,
    fontWeight: typography.weight.black,
  },
});
