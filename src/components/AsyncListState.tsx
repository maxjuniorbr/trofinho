import { StyleSheet, View, Text, ActivityIndicator, Pressable } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type Props = Readonly<{
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
}>;

/**
 * Estado visual para listas assíncronas.
 * Exibe loading, erro com retry, ou mensagem de lista vazia.
 */
export default function AsyncListState({
  loading,
  error,
  empty,
  emptyMessage = 'Nada encontrado.',
  onRetry,
}: Props) {
  const { colors } = useTheme();
  const hasRetry = typeof onRetry === 'function';

  if (loading) {
    return (
      <View style={styles.container} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color={colors.brand.vivid} />
        <Text style={[styles.texto, { color: colors.text.secondary }]}>Carregando…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={[styles.texto, { color: colors.text.secondary }]} accessibilityRole="alert">{error}</Text>
        {hasRetry ? (
          <Pressable
            style={({ pressed }) => [
              styles.botao,
              { backgroundColor: colors.brand.vivid },
              pressed && { opacity: 0.85 },
            ]}
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text style={styles.botaoTexto}>Tentar novamente</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (empty) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>📭</Text>
        <Text style={[styles.texto, { color: colors.text.secondary }]}>{emptyMessage}</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['8'],
    paddingVertical: spacing['12'],
    gap: spacing['3'],
  },
  emoji: { fontSize: 40 },
  texto: {
    fontSize: typography.size.sm,
    textAlign: 'center',
    lineHeight: typography.lineHeight.sm,
  },
  botao: {
    borderRadius: radii.md,
    borderCurve: 'continuous',
    paddingVertical: spacing['3'],
    paddingHorizontal: spacing['5'],
    marginTop: spacing['1'],
    minHeight: 44,
    justifyContent: 'center',
  },
  botaoTexto: {
    color: '#fff',
    fontSize: typography.size.sm,
    fontFamily: typography.family.semibold,
  },
});
