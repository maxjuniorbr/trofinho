import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export type SegmentOption<K extends string = string> = Readonly<{
  key: K;
  label: string;
  accessibilityLabel?: string;
}>;

type SegmentedBarProps<K extends string> = Readonly<{
  options: readonly SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  role?: 'admin' | 'filho';
}>;

export function SegmentedBar<K extends string>({
  options,
  value,
  onChange,
  role = 'admin',
}: SegmentedBarProps<K>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const activeColor = role === 'filho' ? colors.accent.filho : colors.accent.admin;
  const inactiveColor = role === 'filho' ? colors.accent.filhoBg : colors.accent.adminBg;

  return (
    <View style={styles.bar}>
      {options.map((opt) => {
        const isActive = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            style={[styles.pill, { backgroundColor: isActive ? activeColor : inactiveColor }]}
            onPress={() => onChange(opt.key)}
            accessibilityRole="button"
            accessibilityLabel={opt.accessibilityLabel ?? opt.label}
          >
            <Text style={[styles.label, isActive && { color: colors.text.inverse }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.bg.surface,
      paddingHorizontal: spacing['4'],
      paddingTop: spacing['3'],
      paddingBottom: spacing['3'],
      gap: spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    pill: {
      flex: 1,
      paddingVertical: spacing['2'],
      borderRadius: radii.md,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    label: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      color: colors.text.secondary,
    },
  });
}
