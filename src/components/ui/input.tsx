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
  { label, error, noMarginBottom = false, style, editable, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const isDisabled = editable === false;

  return (
    <View style={[styles.wrapper, noMarginBottom ? styles.noMarginBottom : null]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rest.accessibilityLabel ?? label}
        editable={editable}
        style={[
          styles.input,
          {
            backgroundColor: isDisabled ? colors.bg.muted : colors.bg.surface,
            color: isDisabled ? colors.text.muted : colors.text.primary,
            borderColor: error ? colors.border.error : colors.border.default,
            minHeight: 48,
          },
          isDisabled && styles.disabled,
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
  disabled: {
    opacity: 0.6,
  },
  errorText: {
    fontSize: typography.size.xs,
    marginTop: spacing['1'],
  },
});
