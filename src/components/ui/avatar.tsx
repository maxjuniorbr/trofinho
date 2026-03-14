import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { typography } from '@/constants/theme';

interface AvatarProps {
  /** The full name — first character is used as initial */
  name: string;
  size?: number;
  /** Optional override background color (e.g. per-role accent) */
  color?: string;
}

export function Avatar({ name, size = 44, color }: AvatarProps) {
  const { colors } = useTheme();
  const bg = color ?? colors.brand.subtle;
  const fg = color ? colors.text.inverse : colors.brand.dim;
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const fontSize = Math.round(size * 0.42);

  return (
    <View
      style={[
        styles.base,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initial, { color: fg, fontSize }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: typography.weight.bold,
  },
});
