import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';

interface EmptyStateProps {
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
}

type ReadonlyEmptyStateProps = Readonly<EmptyStateProps>;

export function EmptyState({
  loading = false,
  error = null,
  empty = false,
  emptyTitle,
  emptyMessage = 'Nenhum item encontrado.',
  onRetry,
}: ReadonlyEmptyStateProps) {
  const { colors } = useTheme();
  const hasRetry = typeof onRetry === 'function';
  const hasEmptyTitle = Boolean(emptyTitle);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.brand.vivid} size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={[styles.icon]}>⚠️</Text>
        <Text style={[styles.title, { color: colors.text.primary }]}>Algo deu errado</Text>
        <Text style={[styles.message, { color: colors.text.secondary }]}>{error}</Text>
        {hasRetry ? (
          <Pressable onPress={onRetry} style={[styles.retryBtn, { backgroundColor: colors.bg.elevated }]}>
            <Text style={[styles.retryLabel, { color: colors.text.primary }]}>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.center}>
        <Text style={styles.icon}>📭</Text>
        {hasEmptyTitle ? (
          <Text style={[styles.title, { color: colors.text.primary }]}>{emptyTitle}</Text>
        ) : null}
        <Text style={[styles.message, { color: colors.text.secondary }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['8'],
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing['3'],
  },
  title: {
    fontSize: typography.size.lg,
    fontWeight: typography.weight.bold,
    textAlign: 'center',
    marginBottom: spacing['2'],
  },
  message: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: spacing['4'],
    paddingVertical: spacing['2'],
    paddingHorizontal: spacing['5'],
    borderRadius: 8,
  },
  retryLabel: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
  },
});
