import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { radii, spacing, typography } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type AuthDarkFieldProps = TextInputProps &
  Readonly<{
    label: string;
    focused: boolean;
    leftIcon?: LucideIcon;
    rightAction?: ReactNode;
  }>;

/**
 * Themed auth text input. Pairs an uppercase tracked label with a translucent
 * input row sitting on the auth hero gradient. Switches palette automatically
 * to match the device color scheme via `useHeroPalette()`.
 */
export const AuthDarkField = ({
  label,
  focused,
  leftIcon: LeftIcon,
  rightAction,
  style,
  ...inputProps
}: AuthDarkFieldProps) => {
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);
  const hasIcon = Boolean(LeftIcon);

  return (
    <View style={styles.fieldGroup}>
      <View style={styles.labelRow}>
        <Text style={styles.label} allowFontScaling={false}>
          {label}
        </Text>
      </View>
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: focused ? palette.surfaceFieldFocus : palette.surfaceField,
            borderColor: focused ? palette.borderFocus : palette.borderSoft,
          },
        ]}
      >
        {LeftIcon ? (
          <LeftIcon size={18} color={palette.textOnNavySubtle} strokeWidth={1.75} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, hasIcon ? styles.inputWithIcon : null, style]}
          placeholderTextColor={palette.textOnNavyFaint}
          selectionColor={palette.borderFocus}
          {...inputProps}
        />
        {rightAction ?? null}
      </View>
    </View>
  );
};

export const DarkPasswordToggle = ({
  visible,
  onToggle,
}: Readonly<{ visible: boolean; onToggle: () => void }>) => {
  const { palette } = useHeroPalette();
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      <Icon size={18} color={palette.textOnNavyMuted} strokeWidth={1.75} />
    </Pressable>
  );
};

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
  return StyleSheet.create({
    fieldGroup: {
      marginTop: spacing['4'],
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing['2'],
    },
    label: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.4,
      color: palette.textOnNavySubtle,
      textTransform: 'uppercase',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderRadius: radii.inner,
      paddingHorizontal: spacing['4'],
      minHeight: 56,
      gap: spacing['3'],
    },
    input: {
      flex: 1,
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      fontFamily: typography.family.medium,
      color: palette.textOnNavy,
    },
    inputWithIcon: {
      paddingLeft: 0,
    },
  });
}

