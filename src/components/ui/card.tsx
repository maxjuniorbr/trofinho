import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing } from '@/constants/theme';

interface CardProps extends ViewProps {
  /** Elevates card with a stronger shadow */
  elevated?: boolean;
  /** Removes all padding (e.g. for image-only cards) */
  noPadding?: boolean;
  /**
   * Adds a gold ambient glow shadow + subtle gold border.
   * Use on featured/highlighted cards (saldo hero, prize cards, etc.)
   */
  glow?: boolean;
}

type ReadonlyCardProps = Readonly<CardProps>;

export function Card({ elevated = false, noPadding = false, glow = false, style, children, ...rest }: ReadonlyCardProps) {
  const { colors } = useTheme();
  let shadowStyle = styles.baseShadow;
  if (glow) shadowStyle = styles.glowShadow;
  else if (elevated) shadowStyle = styles.elevatedShadow;

  return (
    <View
      {...rest}
      style={[
        styles.base,
        shadowStyle,
        {
          backgroundColor: colors.bg.surface,
          borderColor: glow ? colors.brand.vivid + '33' : colors.border.subtle, // +33 = 20% opacity
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
});
