import React from 'react';
import { StyleSheet, View, type ViewStyle, type ViewProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  elevated?: boolean;
  noPadding?: boolean;
  glow?: boolean;
}

type ReadonlyCardProps = Readonly<CardProps>;

export function Card({ elevated = false, noPadding = false, glow = false, style, children, ...rest }: ReadonlyCardProps) {
  const { colors, isDark } = useTheme();
  let shadowStyle: ViewStyle = styles.baseShadow;
  if (glow) shadowStyle = isDark ? styles.glowShadowDark : styles.glowShadow;
  else if (elevated) shadowStyle = styles.elevatedShadow;

  const glowBorderOpacity = isDark ? '4D' : '33';

  return (
    <View
      {...rest}
      style={[
        styles.base,
        shadowStyle,
        {
          backgroundColor: colors.bg.surface,
          borderColor: glow ? colors.brand.vivid + glowBorderOpacity : colors.border.subtle,
          padding: noPadding ? 0 : spacing.card,
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
    borderRadius: radii.outer,
    borderWidth: 1,
    overflow: 'hidden',
  },
  baseShadow:     { ...shadows.card, shadowOpacity: 0.12 },
  elevatedShadow: { ...shadows.card },
  glowShadow:     { ...shadows.goldGlow },
  glowShadowDark: { ...shadows.goldGlow, shadowOpacity: 0.55, shadowRadius: 28 },
});
