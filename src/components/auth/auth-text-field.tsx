import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { type LucideIcon } from 'lucide-react-native';

type AuthTextFieldProps = TextInputProps &
  Readonly<{
    label: string;
    focused: boolean;
    leftIcon?: LucideIcon;
    rightAction?: ReactNode;
  }>;

export const AuthTextField = ({
  label,
  focused,
  leftIcon: LeftIcon,
  rightAction,
  style,
  ...inputProps
}: AuthTextFieldProps) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const hasIcon = Boolean(LeftIcon);

  return (
    <>
      <Text style={[styles.label, { color: colors.text.secondary }]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.bg.elevated,
            borderColor: focused ? colors.border.focus : colors.border.default,
          },
        ]}
      >
        {LeftIcon ? <LeftIcon size={18} color={colors.text.muted} strokeWidth={1.5} /> : null}
        <TextInput
          accessibilityLabel={label}
          style={[
            styles.input,
            hasIcon && styles.inputWithIcon,
            { color: colors.text.primary },
            style,
          ]}
          placeholderTextColor={colors.text.muted}
          {...inputProps}
        />
        {rightAction ?? null}
      </View>
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
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radii.inner,
      paddingHorizontal: spacing['4'],
      minHeight: 48,
      gap: spacing['2'],
    },
    input: {
      flex: 1,
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      fontFamily: typography.family.medium,
    },
    inputWithIcon: {
      paddingLeft: 0,
    },
  });
}
