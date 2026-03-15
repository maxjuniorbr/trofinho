import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

interface PointsDisplayProps {
  /** Numeric value — displayed formatted with pt-BR locale (e.g. 1.250) */
  value: number;
  /** Caption below the number (e.g. "pontos disponíveis") */
  label: string;
  /**
   * Controls the text color of the value:
   *   gold    → brand.vivid (#FAC114)
   *   amber   → brand.dim   (#C57B0D)
   *   default → text.primary
   */
  variant?: 'gold' | 'amber' | 'default';
  /** sm = xl font (28px), lg = 3xl font (40px) */
  size?: 'sm' | 'lg';
}

type ReadonlyPointsDisplayProps = Readonly<PointsDisplayProps>;

export function PointsDisplay({ value, label, variant = 'gold', size = 'sm' }: ReadonlyPointsDisplayProps) {
  const { colors } = useTheme();

  function valueColor() {
    switch (variant) {
      case 'gold':  return colors.brand.vivid;
      case 'amber': return colors.brand.dim;
      default:      return colors.text.primary;
    }
  }

  const valueFontSize = size === 'lg' ? 40 : 28;

  const formatted = value.toLocaleString('pt-BR');

  return (
    <View style={styles.container}>
      <Text
        style={[
          styles.value,
          { color: valueColor(), fontSize: valueFontSize },
        ]}
      >
        {formatted}
      </Text>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  value: {
    fontFamily: typography.family.black,
    fontWeight: typography.weight.black,
    includeFontPadding: false,
    lineHeight: undefined, // let RN auto-calculate per fontFamily
    fontVariant: ['tabular-nums'] as const,
  },
  label: {
    fontFamily: typography.family.semibold,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
