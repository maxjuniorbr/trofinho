import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: ReactNode;
  /** Role determines the back-button / accent color ('admin' | 'filho') */
  role?: 'admin' | 'filho';
}

export function ScreenHeader({
  title,
  onBack,
  backLabel = '← Voltar',
  rightAction,
  role = 'admin',
}: ScreenHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = role === 'filho' ? colors.accent.filho : colors.accent.admin;

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing['3'],
          backgroundColor: colors.bg.surface,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      {onBack ? (
        <Pressable onPress={onBack} style={styles.side} hitSlop={8}>
          <Text style={[styles.backLabel, { color: accent }]}>{backLabel}</Text>
        </Pressable>
      ) : (
        <View style={styles.side} />
      )}

      <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={1}>
        {title}
      </Text>

      <View style={styles.side}>
        {rightAction ?? null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing['3'],
    paddingHorizontal: spacing['5'],
    borderBottomWidth: 1,
  },
  side: {
    minWidth: 70,
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    flex: 1,
    textAlign: 'center',
  },
  backLabel: {
    fontSize: typography.size.md,
    fontWeight: typography.weight.medium,
  },
});
