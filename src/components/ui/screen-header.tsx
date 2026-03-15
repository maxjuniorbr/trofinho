import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';
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
  backTone?: 'accent' | 'muted';
  surface?: 'surface' | 'canvas';
  showBorder?: boolean;
}

type ReadonlyScreenHeaderProps = Readonly<ScreenHeaderProps>;

type HeaderIconButtonProps = Readonly<{
  icon: LucideIcon;
  onPress: () => void;
  accessibilityLabel: string;
  role?: 'admin' | 'filho';
  tone?: 'accent' | 'muted';
}>;

export function HeaderIconButton({
  icon: Icon,
  onPress,
  accessibilityLabel,
  role = 'admin',
  tone = 'muted',
}: HeaderIconButtonProps) {
  const { colors, isDark } = useTheme();
  const accent = role === 'filho' ? colors.accent.filho : colors.accent.admin;
  const backgroundColor = tone === 'muted' ? colors.bg.muted : accent;
  const iconColor = tone === 'muted'
    ? (isDark ? colors.text.inverse : colors.text.primary)
    : colors.text.inverse;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Icon size={20} color={iconColor} strokeWidth={2.5} />
    </Pressable>
  );
}

export function ScreenHeader({
  title,
  onBack,
  backLabel = 'Voltar',
  rightAction,
  role = 'admin',
  backTone = role === 'filho' ? 'accent' : 'muted',
  surface = 'surface',
  showBorder = true,
}: ReadonlyScreenHeaderProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const displayLabel = backLabel.replace(/^←\s*/, '');

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + spacing['3'],
          backgroundColor: surface === 'canvas' ? colors.bg.canvas : colors.bg.surface,
          borderBottomColor: colors.border.subtle,
          borderBottomWidth: showBorder ? 1 : 0,
        },
      ]}
    >
      {onBack ? (
        <HeaderIconButton
          icon={ChevronLeft}
          onPress={() => {
            if (router.canGoBack()) {
              onBack();
            } else {
              router.replace(role === 'filho' ? '/(child)/' : '/(admin)/');
            }
          }}
          accessibilityLabel={`Voltar para ${displayLabel}`}
          role={role}
          tone={backTone}
        />
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
    paddingHorizontal: spacing['4'],
  },
  side: {
    minWidth: 40,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: radii.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
    flex: 1,
    textAlign: 'center',
  },
});
