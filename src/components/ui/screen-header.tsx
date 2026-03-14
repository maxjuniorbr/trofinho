import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  rightAction?: ReactNode;
  /** Role determines the back-button / accent color ('admin' | 'filho') */
  role?: 'admin' | 'filho';
}

type ReadonlyScreenHeaderProps = Readonly<ScreenHeaderProps>;

export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Voltar',
  rightAction,
  role = 'admin',
}: ReadonlyScreenHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const accent = role === 'filho' ? colors.accent.filho : colors.accent.admin;
  const displayLabel = backLabel.replace(/^←\s*/, '');

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing['2'],
          backgroundColor: colors.bg.surface,
          borderBottomColor: colors.border.subtle,
        },
      ]}
    >
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Voltar para ${displayLabel}`}
        >
          <Ionicons name="chevron-back" size={26} color={accent} />
          <Text style={[styles.backLabel, { color: accent }]}>{displayLabel}</Text>
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
    paddingBottom: spacing['2'],
    paddingHorizontal: spacing['2'],
    borderBottomWidth: 1,
  },
  side: {
    minWidth: 80,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 80,
    minHeight: 44,
    borderRadius: radii.md,
    paddingRight: spacing['2'],
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
    flex: 1,
    textAlign: 'center',
  },
  backLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.semibold,
    marginLeft: 2,
  },
});
