import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  /** Elevates card with a stronger shadow */
  elevated?: boolean;
  /** Removes all padding (e.g. for image-only cards) */
  noPadding?: boolean;
}

export function Card({ elevated = false, noPadding = false, style, children, ...rest }: CardProps) {
  const { colors } = useTheme();

  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: elevated ? colors.bg.elevated : colors.bg.surface,
          borderColor: colors.border.subtle,
          boxShadow: elevated ? colors.shadow.medium : colors.shadow.low,
          padding: noPadding ? 0 : spacing['4'],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
