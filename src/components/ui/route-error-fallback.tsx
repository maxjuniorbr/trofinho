import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';

type RouteErrorFallbackProps = Readonly<{
  error: Error;
  retry: () => void;
}>;

export function ErrorBoundary({ error, retry }: RouteErrorFallbackProps) {
  const { colors } = useTheme();

  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <SafeScreenFrame topInset>
      <View style={styles.center}>
        <AlertTriangle size={36} color={colors.semantic.warning} strokeWidth={1.5} />
        <Text style={[styles.title, { color: colors.text.primary }]}>Algo deu errado.</Text>
        <Pressable
          onPress={retry}
          style={[styles.retryBtn, { backgroundColor: colors.bg.elevated }]}
          accessibilityRole="button"
          accessibilityLabel="Voltar ao início"
        >
          <Text style={[styles.retryLabel, { color: colors.text.primary }]}>Voltar ao início</Text>
        </Pressable>
      </View>
    </SafeScreenFrame>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['8'],
    gap: spacing['2'],
  },
  title: {
    fontSize: typography.size.lg,
    fontFamily: typography.family.bold,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: spacing['3'],
    paddingVertical: spacing['2'],
    paddingHorizontal: spacing['5'],
    borderRadius: radii.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  retryLabel: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.semibold,
  },
});
