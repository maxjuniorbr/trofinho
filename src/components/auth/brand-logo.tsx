import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, heroPalette, shadows, typography } from '@/constants/theme';

type BrandLogoSize = 'sm' | 'md' | 'lg' | 'xl';
type BrandLogoVariant = 'default' | 'onDark';

type BrandLogoProps = Readonly<{
  size?: BrandLogoSize;
  withText?: boolean;
  variant?: BrandLogoVariant;
}>;

type SizeTokens = Readonly<{
  box: number;
  radius: number;
  monoFontSize: number;
  textFontSize: number;
  gap: number;
}>;

const SIZE_TOKENS: Record<BrandLogoSize, SizeTokens> = {
  sm: { box: 32, radius: 8, monoFontSize: 16, textFontSize: 16, gap: 8 },
  md: { box: 44, radius: 12, monoFontSize: 20, textFontSize: 18, gap: 10 },
  lg: { box: 64, radius: 16, monoFontSize: 30, textFontSize: 24, gap: 10 },
  xl: { box: 80, radius: 20, monoFontSize: 36, textFontSize: 30, gap: 12 },
};

/**
 * Trofinho brand mark — gold "T" monogram on a navy gradient tile.
 * Mature, premium, suitable for tweens (8–14).
 */
export const BrandLogo = ({
  size = 'md',
  withText = false,
  variant = 'default',
}: BrandLogoProps) => {
  const tokens = SIZE_TOKENS[size];
  const styles = useMemo(() => makeStyles(tokens), [tokens]);
  const textColor = variant === 'onDark' ? heroPalette.textOnNavy : heroPalette.textOnLight;

  return (
    <View style={styles.container} accessibilityRole="image" accessibilityLabel="Trofinho">
      <LinearGradient
        colors={gradients.heroNavy.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tile}
      >
        <View style={styles.glow} />
        <Text style={styles.mono} allowFontScaling={false}>
          T
        </Text>
      </LinearGradient>
      {withText ? (
        <Text style={[styles.brandText, { color: textColor }]} allowFontScaling={false}>
          Trofinho
        </Text>
      ) : null}
    </View>
  );
};

function makeStyles(tokens: SizeTokens) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: tokens.gap,
    },
    tile: {
      width: tokens.box,
      height: tokens.box,
      borderRadius: tokens.radius,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      ...shadows.card,
    },
    glow: {
      position: 'absolute',
      top: -tokens.box * 0.35,
      left: -tokens.box * 0.2,
      right: -tokens.box * 0.2,
      height: tokens.box,
      borderRadius: tokens.box,
      backgroundColor: heroPalette.glowGold,
      opacity: 0.6,
    },
    mono: {
      fontFamily: typography.family.black,
      fontSize: tokens.monoFontSize,
      lineHeight: tokens.monoFontSize,
      color: heroPalette.borderFocus,
      letterSpacing: -0.5,
    },
    brandText: {
      fontFamily: typography.family.extrabold,
      fontSize: tokens.textFontSize,
      letterSpacing: -0.3,
    },
  });
}
