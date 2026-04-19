import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { spacing, typography } from '@/constants/theme';
import { WEEKDAY_LABELS, isDayActive, toggleDay } from '@lib/tasks';

const WEEKDAY_FULL_NAMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
] as const;

const CIRCLE_SIZE = 40;

type WeekdaySelectorProps = Readonly<{
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}>;

export function WeekdaySelector({ value, onChange, disabled = false }: WeekdaySelectorProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {WEEKDAY_LABELS.map((label, dow) => {
        const active = isDayActive(value, dow);

        return (
          <Pressable
            key={dow}
            style={[
              styles.circle,
              active ? styles.circleActive : styles.circleInactive,
              disabled && styles.circleDisabled,
            ]}
            onPress={() => {
              if (!disabled) onChange(toggleDay(value, dow));
            }}
            accessibilityRole="button"
            accessibilityLabel={WEEKDAY_FULL_NAMES[dow]}
            accessibilityState={{ selected: active, disabled }}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing['1'],
    },
    circle: {
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      borderRadius: CIRCLE_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    circleActive: {
      backgroundColor: colors.accent.admin,
      borderColor: colors.accent.admin,
    },
    circleInactive: {
      backgroundColor: colors.bg.surface,
      borderColor: colors.border.default,
    },
    circleDisabled: {
      opacity: 0.55,
    },
    label: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
    labelActive: {
      color: colors.text.inverse,
    },
    labelInactive: {
      color: colors.text.secondary,
    },
  });
}
