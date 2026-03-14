import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

/**
 * Variants aligned with design-studio StatusBadge:
 * pending=warning  approved=success  rejected=error
 * active=brand     inactive=neutral
 */
type BadgeVariant =
  | 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'brand'
  | 'pending' | 'approved' | 'rejected' | 'active' | 'inactive';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

type ReadonlyBadgeProps = Readonly<BadgeProps>;

// Map status aliases to semantic variants
function resolveVariant(v: BadgeVariant): 'success' | 'error' | 'warning' | 'info' | 'neutral' | 'brand' {
  switch (v) {
    case 'pending':  return 'warning';
    case 'approved': return 'success';
    case 'rejected': return 'error';
    case 'active':   return 'brand';
    case 'inactive': return 'neutral';
    default:         return v;
  }
}

export function Badge({ label, variant = 'neutral', size = 'sm' }: ReadonlyBadgeProps) {
  const { colors } = useTheme();
  const resolved = resolveVariant(variant);

  function bg() {
    switch (resolved) {
      case 'success': return colors.semantic.successBg;
      case 'error':   return colors.semantic.errorBg;
      case 'warning': return colors.semantic.warningBg;
      case 'info':    return colors.semantic.infoBg;
      case 'brand':   return colors.brand.subtle;
      default:        return colors.bg.muted;
    }
  }

  function fg() {
    switch (resolved) {
      case 'success': return colors.semantic.success;
      case 'error':   return colors.semantic.error;
      case 'warning': return colors.semantic.warning;
      case 'info':    return colors.semantic.info;
      case 'brand':   return colors.brand.vivid;
      default:        return colors.text.secondary;
    }
  }

  const paddingV = size === 'md' ? spacing['2'] : 3;
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
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: typography.family.black,
  },
});
