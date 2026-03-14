import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  label: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  label,
  disabled,
  onPress,
  ...rest
}: ButtonProps) {
  const { colors } = useTheme();

  const isDisabled = disabled || loading;

  function bg() {
    switch (variant) {
      case 'primary':   return colors.brand.vivid;
      case 'secondary': return colors.bg.elevated;
      case 'ghost':     return 'transparent';
      case 'danger':    return colors.semantic.errorBg;
    }
  }

  function fg() {
    switch (variant) {
      case 'primary':   return colors.text.onBrand;
      case 'secondary': return colors.text.primary;
      case 'ghost':     return colors.text.secondary;
      case 'danger':    return colors.semantic.error;
    }
  }

  function borderColor() {
    switch (variant) {
      case 'secondary': return colors.border.default;
      case 'ghost':     return 'transparent';
      default:          return 'transparent';
    }
  }

  const paddingV = size === 'sm' ? spacing['2'] : size === 'lg' ? spacing['4'] : spacing['3'];
  const paddingH = size === 'sm' ? spacing['3'] : size === 'lg' ? spacing['6'] : spacing['5'];
  const fontSize  = size === 'sm' ? typography.size.sm : size === 'lg' ? typography.size.lg : typography.size.md;

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
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg(),
          borderColor: borderColor(),
          borderWidth: variant === 'secondary' ? 1 : 0,
          paddingVertical: paddingV,
          paddingHorizontal: paddingH,
          opacity: isDisabled ? 0.45 : pressed ? 0.8 : 1,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg()} size="small" />
      ) : (
        <Text style={[styles.label, { color: fg(), fontSize, }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  label: {
    fontWeight: typography.weight.semibold,
  },
});
