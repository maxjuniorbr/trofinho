import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'brand';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const { colors } = useTheme();

  function bg() {
    switch (variant) {
      case 'success': return colors.semantic.successBg;
      case 'error':   return colors.semantic.errorBg;
      case 'warning': return colors.semantic.warningBg;
      case 'info':    return colors.semantic.infoBg;
      case 'brand':   return colors.brand.subtle;
      default:        return colors.bg.muted;
    }
  }

  function fg() {
    switch (variant) {
      case 'success': return colors.semantic.success;
      case 'error':   return colors.semantic.error;
      case 'warning': return colors.semantic.warning;
      case 'info':    return colors.semantic.info;
      case 'brand':   return colors.brand.dim;
      default:        return colors.text.secondary;
    }
  }

  const paddingV = size === 'md' ? spacing['2'] : spacing['1'];
  const paddingH = size === 'md' ? spacing['3'] : spacing['2'];
  const fontSize  = size === 'md' ? typography.size.sm : typography.size.xs;

  return (
    <View style={[styles.base, { backgroundColor: bg(), paddingVertical: paddingV, paddingHorizontal: paddingH }]}>
      <Text style={[styles.label, { color: fg(), fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: typography.weight.semibold,
  },
});
