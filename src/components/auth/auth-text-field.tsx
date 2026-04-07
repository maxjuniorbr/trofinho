import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type AuthTextFieldProps = TextInputProps &
  Readonly<{
    label: string;
    focused: boolean;
  }>;

export const AuthTextField = ({ label, focused, style, ...inputProps }: AuthTextFieldProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          styles.input,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: focused ? colors.border.focus : colors.border.default,
            color: colors.text.primary,
          },
          style,
        ]}
        placeholderTextColor={colors.text.muted}
        {...inputProps}
      />
    </>
  );
};

function makeStyles() {
  return StyleSheet.create({
    label: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      marginBottom: spacing['1'],
      marginTop: spacing['4'],
    },
    input: {
      borderWidth: 1,
      borderRadius: radii.inner,
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      fontFamily: typography.family.medium,
      minHeight: 48,
    },
  });
}
