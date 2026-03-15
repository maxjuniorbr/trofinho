import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
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
  const router = useRouter();
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
          onPress={() => {
            if (router.canGoBack()) {
              onBack();
            } else {
              router.replace(role === 'filho' ? '/(child)/' : '/(admin)/');
            }
          }}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: accent, opacity: pressed ? 0.7 : 1 }]}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`Voltar para ${displayLabel}`}
        >
          <ChevronLeft size={20} color={colors.text.inverse} strokeWidth={2.5} />
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
    minWidth: 44,
  },
  backBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
    borderRadius: radii.md,
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
    flex: 1,
    textAlign: 'center',
  },
});
