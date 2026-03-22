import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/theme-context';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
  loadingLabel?: string;
}

type ReadonlyButtonProps = Readonly<ButtonProps>;

type ButtonSizeTokens = Readonly<{
  fontSize: number;
  lineHeight: number;
  paddingHorizontal: number;
  paddingVertical: number;
  minHeight: number;
}>;

function getSizeTokens(size: Size): ButtonSizeTokens {
  switch (size) {
    case 'sm':
      return {
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight.sm,
        paddingHorizontal: spacing['4'],
        paddingVertical: spacing['2'],
        minHeight: 44,
      };
    case 'lg':
      return {
        fontSize: typography.size.lg,
        lineHeight: typography.lineHeight.lg,
        paddingHorizontal: spacing['8'],
        paddingVertical: spacing['4'],
        minHeight: 56,
      };
    default:
      return {
        fontSize: typography.size.md,
        lineHeight: typography.lineHeight.md,
        paddingHorizontal: spacing['6'],
        paddingVertical: spacing['3'],
        minHeight: 48,
      };
  }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  loadingLabel,
  disabled,
  onPress,
  ...rest
}: ReadonlyButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;
  const { fontSize, lineHeight, paddingHorizontal, paddingVertical, minHeight } = getSizeTokens(size);

  const isPrimary = variant === 'primary';

  const bg = () => {
    switch (variant) {
      case 'primary':   return colors.brand.vivid;
      case 'secondary': return colors.bg.elevated;
      case 'ghost':     return 'transparent';
      case 'danger':    return colors.semantic.errorBg;
      case 'outline':   return 'transparent';
    }
  };

  const fg = () => {
    switch (variant) {
      case 'primary':   return colors.text.onBrand;
      case 'secondary': return colors.text.primary;
      case 'ghost':     return colors.text.secondary;
      case 'danger':    return colors.semantic.error;
      case 'outline':   return colors.brand.vivid;
    }
  };

  const borderColor = () => {
    switch (variant) {
      case 'secondary': return colors.border.default;
      case 'outline':   return colors.brand.vivid + '4D'; // 30% opacity
      default:          return 'transparent';
    }
  };

  const handlePress = async (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
    if (!isDisabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    }
  };

  const fontFamily = isPrimary ? typography.family.bold : typography.family.semibold;
  const fgColor = fg();

  let buttonContent: React.ReactNode;
  if (loading && loadingLabel) {
    buttonContent = (
      <View style={styles.loadingRow}>
        <ActivityIndicator color={fgColor} size="small" />
        <Text style={[styles.label, { color: fgColor, fontSize, lineHeight, fontFamily }]}>
          {loadingLabel}
        </Text>
      </View>
    );
  } else if (loading) {
    buttonContent = <ActivityIndicator color={fgColor} size="small" />;
  } else {
    buttonContent = (
      <Text style={[styles.label, { color: fgColor, fontSize, lineHeight, fontFamily }]}>
        {label}
      </Text>
    );
  }

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => {
        let opacity = 1;
        if (isDisabled) opacity = 0.45;
        else if (pressed) opacity = isPrimary ? 0.82 : 0.8;

        return [
          styles.base,
          isPrimary ? styles.primaryShadow : null,
          {
            backgroundColor: isPrimary ? 'transparent' : bg(),
            borderColor: borderColor(),
            borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
            opacity,
          },
        ];
      }}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.gold.colors}
          start={gradients.gold.start}
          end={gradients.gold.end}
          style={[
            styles.gradientFill,
            { paddingHorizontal, paddingVertical, minHeight, borderRadius: radii.inner },
          ]}
        >
          {buttonContent}
        </LinearGradient>
      ) : (
        <View style={[styles.innerPad, { paddingHorizontal, paddingVertical, minHeight }]}>
          {buttonContent}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.inner,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  primaryShadow: {
    ...shadows.goldButton,
  },
  gradientFill: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  innerPad: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: typography.weight.bold,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
});
