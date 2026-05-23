import React, { forwardRef } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { opacityDisabled, radii, spacing, typography } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label: string;
  error?: string | null;
  noMarginBottom?: boolean;
  leadingIcon?: LucideIcon;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, noMarginBottom = false, leadingIcon: LeadingIcon, style, editable, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const isDisabled = editable === false;

  return (
    <View style={[styles.wrapper, noMarginBottom ? styles.noMarginBottom : null]}>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <View style={styles.inputRow}>
        {LeadingIcon ? (
          <View style={styles.iconBox} pointerEvents="none">
            <LeadingIcon size={18} color={colors.text.muted} strokeWidth={2} />
          </View>
        ) : null}
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
              minHeight: 52,
              paddingLeft: LeadingIcon ? spacing['10'] : spacing['4'],
            },
            isDisabled && styles.disabled,
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          {...rest}
        />
      </View>
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
    fontFamily: typography.family.extrabold,
    fontSize: typography.size.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: spacing['1'],
  },
  inputRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  iconBox: {
    position: 'absolute',
    left: spacing['3'],
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['4'],
    fontSize: typography.size.md,
  },
  disabled: {
    opacity: opacityDisabled.light,
  },
  errorText: {
    fontSize: typography.size.xs,
    marginTop: spacing['1'],
  },
});
