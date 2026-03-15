import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock, Eye, CheckCircle2, XCircle } from 'lucide-react-native';
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

const STATUS_ICONS = {
  pending:  Clock,
  approved: CheckCircle2,
  rejected: XCircle,
} as const;

const AWAITING_ICON = Eye;

type StatusAlias = keyof typeof STATUS_ICONS;

function getStatusIcon(variant: BadgeVariant) {
  if (variant === 'info') return AWAITING_ICON;
  if (variant in STATUS_ICONS) return STATUS_ICONS[variant as StatusAlias];
  return null;
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
      case 'success': return colors.semantic.successText;
      case 'error':   return colors.semantic.errorText;
      case 'warning': return colors.semantic.warningText;
      case 'info':    return colors.semantic.infoText;
      case 'brand':   return colors.brand.vivid;
      default:        return colors.text.secondary;
    }
  }

  const paddingV = size === 'md' ? spacing['2'] : 3;
  const paddingH = size === 'md' ? spacing['3'] : spacing['2'];
  const fontSize  = size === 'md' ? typography.size.sm : typography.size.xs;
  const iconSize  = size === 'md' ? 14 : 12;

  const Icon = getStatusIcon(variant);
  const color = fg();

  return (
    <View style={[styles.base, { backgroundColor: bg(), paddingVertical: paddingV, paddingHorizontal: paddingH }]}>
      {Icon ? <Icon size={iconSize} color={color} strokeWidth={2} /> : null}
      <Text style={[styles.label, { color, fontSize }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontWeight: typography.weight.black,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    fontFamily: typography.family.black,
  },
});
