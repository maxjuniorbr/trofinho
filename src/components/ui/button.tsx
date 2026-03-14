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
}

type ReadonlyButtonProps = Readonly<ButtonProps>;

type ButtonSizeTokens = Readonly<{
  fontSize: number;
  paddingHorizontal: number;
  paddingVertical: number;
}>;

function getSizeTokens(size: Size): ButtonSizeTokens {
  switch (size) {
    case 'sm':
      return {
        fontSize: typography.size.sm,
        paddingHorizontal: spacing['3'],
        paddingVertical: spacing['2'],
      };
    case 'lg':
      return {
        fontSize: typography.size.lg,
        paddingHorizontal: spacing['6'],
        paddingVertical: spacing['4'],
      };
    default:
      return {
        fontSize: typography.size.md,
        paddingHorizontal: spacing['5'],
        paddingVertical: spacing['3'],
      };
  }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  disabled,
  onPress,
  ...rest
}: ReadonlyButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;
  const { fontSize, paddingHorizontal, paddingVertical } = getSizeTokens(size);

  const isPrimary = variant === 'primary';

  function bg() {
    switch (variant) {
      case 'primary':   return colors.brand.vivid; // fallback — LinearGradient covers this
      case 'secondary': return colors.bg.elevated;
      case 'ghost':     return 'transparent';
      case 'danger':    return colors.semantic.errorBg;
      case 'outline':   return 'transparent';
    }
  }

  function fg() {
    switch (variant) {
      case 'primary':   return colors.text.onBrand;
      case 'secondary': return colors.text.primary;
      case 'ghost':     return colors.text.secondary;
      case 'danger':    return colors.semantic.error;
      case 'outline':   return colors.brand.vivid;
    }
  }

  function borderColor() {
    switch (variant) {
      case 'secondary': return colors.border.default;
      case 'outline':   return colors.brand.vivid + '4D'; // 30% opacity
      default:          return 'transparent';
    }
  }

  async function handlePress(e: Parameters<NonNullable<PressableProps['onPress']>>[0]) {
    if (!isDisabled) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress?.(e);
    }
  }

  return (
    <Pressable
      {...rest}
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => {
        let opacity = 1;
        if (isDisabled) opacity = 0.45;
        else if (pressed && !isPrimary) opacity = 0.8;

        return [
          styles.base,
          isPrimary ? styles.primaryShadow : null,
          {
            backgroundColor: isPrimary ? 'transparent' : bg(),
            borderColor: borderColor(),
            borderWidth: variant === 'secondary' || variant === 'outline' ? 1 : 0,
            opacity,
            // Primary: slight Y-translate on press to activate 3D effect
            transform: isPrimary && pressed ? [{ translateY: 2 }] : [],
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
            { paddingHorizontal, paddingVertical, borderRadius: radii.inner },
          ]}
        >
          {loading
            ? <ActivityIndicator color={fg()} size="small" />
            : <Text style={[styles.label, { color: fg(), fontSize, fontFamily: typography.family.bold }]}>{label}</Text>}
        </LinearGradient>
      ) : (
        <View style={[styles.innerPad, { paddingHorizontal, paddingVertical }]}>
          {loading
            ? <ActivityIndicator color={fg()} size="small" />
            : <Text style={[styles.label, { color: fg(), fontSize, fontFamily: typography.family.semibold }]}>{label}</Text>}
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
});
