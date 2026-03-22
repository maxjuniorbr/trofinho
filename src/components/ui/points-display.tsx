import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

interface PointsDisplayProps {
  value: number;
  label: string;
  variant?: 'gold' | 'amber' | 'default';
  size?: 'sm' | 'lg';
}

type ReadonlyPointsDisplayProps = Readonly<PointsDisplayProps>;

export function PointsDisplay({ value, label, variant = 'gold', size = 'sm' }: ReadonlyPointsDisplayProps) {
  const { colors } = useTheme();

  const valueColor = () => {
    switch (variant) {
      case 'gold':  return colors.brand.vivid;
      case 'amber': return colors.brand.dim;
      default:      return colors.text.primary;
    }
  };

  const valueFontSize = size === 'lg' ? typography.size['3xl'] : typography.lineHeight.lg;

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
    lineHeight: undefined,
    fontVariant: ['tabular-nums'] as const,
  },
  label: {
    fontFamily: typography.family.semibold,
    fontWeight: typography.weight.semibold,
    fontSize: typography.size.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: spacing['0.5'],
  },
});
