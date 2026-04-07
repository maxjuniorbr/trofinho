import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  noMarginBottom?: boolean;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, noMarginBottom = false, style, ...rest },
  ref,
) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, noMarginBottom ? styles.noMarginBottom : null]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        style={[
          styles.input,
          {
            backgroundColor: colors.bg.surface,
            color: colors.text.primary,
            borderColor: error ? colors.border.error : colors.border.default,
            minHeight: 48,
          },
          style,
        ]}
        placeholderTextColor={colors.text.muted}
        {...rest}
      />
      {error ? (
        <Text style={[styles.errorText, { color: colors.semantic.error }]}>{error}</Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing['4'],
  },
  noMarginBottom: {
    marginBottom: 0,
  },
  label: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    marginBottom: spacing['1'],
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['4'],
    fontSize: typography.size.md,
  },
  errorText: {
    fontSize: typography.size.xs,
    marginTop: spacing['1'],
  },
});
