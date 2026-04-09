import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';

type AuthTextFieldProps = TextInputProps &
  Readonly<{
    label: string;
    focused: boolean;
    leftIcon?: LucideIcon;
    rightAction?: ReactNode;
  }>;

export const AuthTextField = ({ label, focused, leftIcon: LeftIcon, rightAction, style, ...inputProps }: AuthTextFieldProps) => {
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
        {LeftIcon ? (
          <LeftIcon size={18} color={colors.text.muted} strokeWidth={1.5} />
        ) : null}
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

export const PasswordToggle = ({
  visible,
  onToggle,
}: Readonly<{ visible: boolean; onToggle: () => void }>) => {
  const { colors } = useTheme();
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      <Icon size={20} color={colors.text.muted} strokeWidth={1.5} />
    </Pressable>
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
