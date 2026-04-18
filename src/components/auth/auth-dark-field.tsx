import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { heroPalette, radii, spacing, typography } from '@/constants/theme';

type AuthDarkFieldProps = TextInputProps &
  Readonly<{
    label: string;
    focused: boolean;
    leftIcon?: LucideIcon;
    rightAction?: ReactNode;
  }>;

/**
 * Dark variant of the auth text input. Pairs an uppercase tracked label with a
 * translucent input row sitting on the navy hero gradient. Always uses the
 * fixed hero palette regardless of theme.
 */
export const AuthDarkField = ({
  label,
  focused,
  leftIcon: LeftIcon,
  rightAction,
  style,
  ...inputProps
}: AuthDarkFieldProps) => {
  const styles = useMemo(() => makeStyles(), []);
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
            backgroundColor: focused ? heroPalette.surfaceFieldFocus : heroPalette.surfaceField,
            borderColor: focused ? heroPalette.borderFocus : heroPalette.borderSoft,
          },
        ]}
      >
        {LeftIcon ? (
          <LeftIcon size={18} color={heroPalette.textOnNavySubtle} strokeWidth={1.75} />
        ) : null}
        <TextInput
          accessibilityLabel={label}
          style={[styles.input, hasIcon ? styles.inputWithIcon : null, style]}
          placeholderTextColor={heroPalette.textOnNavyFaint}
          selectionColor={heroPalette.borderFocus}
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
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      onPress={onToggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Ocultar senha' : 'Mostrar senha'}
    >
      <Icon size={18} color={heroPalette.textOnNavyMuted} strokeWidth={1.75} />
    </Pressable>
  );
};

function makeStyles() {
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
      color: heroPalette.textOnNavySubtle,
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
      color: heroPalette.textOnNavy,
    },
    inputWithIcon: {
      paddingLeft: 0,
    },
  });
}
