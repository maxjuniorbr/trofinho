import { StyleSheet, View, Text, ActivityIndicator, Pressable } from 'react-native';

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
  const hasRetry = typeof onRetry === 'function';

  if (loading) {
    return (
      <View style={styles.container} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.texto}>Carregando…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>⚠️</Text>
        <Text style={styles.texto} accessibilityRole="alert">{error}</Text>
        {hasRetry ? (
          <Pressable
            style={({ pressed }) => [
              styles.botao,
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
        <Text style={styles.texto}>{emptyMessage}</Text>
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
    paddingHorizontal: 32,
    paddingVertical: 48,
    gap: 12,
  },
  emoji: {
    fontSize: 40,
  },
  texto: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  botao: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 4,
    minHeight: 44,
    justifyContent: 'center',
  },
  botaoTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
