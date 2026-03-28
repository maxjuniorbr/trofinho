import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Pencil, Plus, Trophy } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { useTransientMessage } from '@/hooks/use-transient-message';
import {
  consumeNavigationFeedback,
  type NavigationFeedback,
} from '@lib/navigation-feedback';
import { usePrizes } from '@/hooks/queries';

export default function AdminPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: prizes = [], isLoading, error, refetch } = usePrizes();
  const [successFeedback, setSuccessFeedback] = useState<NavigationFeedback | null>(null);
  const visibleSuccessMessage = useTransientMessage(
    successFeedback?.message ?? null,
    { resetKey: successFeedback?.id },
  );

  useFocusEffect(useCallback(() => {
    const feedback = consumeNavigationFeedback('admin-prize-list');
    if (feedback) setSuccessFeedback(feedback);
  }, []));

  const active = prizes.filter((p) => p.ativo);
  const inactive = prizes.filter((p) => !p.ativo);
  const hasError = Boolean(error);
  const shouldShowEmptyState = isLoading || hasError || prizes.length === 0;
  const emptyStateMessage = 'Nenhum prêmio cadastrado.\nToque em "+" para criar o primeiro prêmio.';
  const inactivePlural = inactive.length === 1 ? '' : 's';
  const inactiveSummary = inactive.length > 0
    ? ` · ${inactive.length} inativo${inactivePlural}`
    : '';

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Prêmios"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => router.push('/(admin)/prizes/new' as never)}
            accessibilityLabel="Criar prêmio"
          />
        }
      />

      {visibleSuccessMessage ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleSuccessMessage} variant="success" />
        </View>
      ) : null}

      {shouldShowEmptyState ? (
        <EmptyState
          loading={isLoading}
          error={error?.message ?? null}
          empty={!isLoading && !error}
          emptyMessage={emptyStateMessage}
          onRetry={() => refetch()}
        />
      ) : (
        <FlatList
          data={prizes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.brand.vivid} />}
          ListHeaderComponent={
            <Text style={styles.resumo}>
              {active.length} ativo{active.length === 1 ? '' : 's'}
              {inactiveSummary}
            </Text>
          }
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                !item.ativo && styles.cardInativo,
              ]}
            >
              <Pressable
                style={({ pressed }) => [
                  styles.cardMain,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                onPress={() => router.push(`/(admin)/prizes/${item.id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`${item.nome}, ${item.custo_pontos} pontos${item.ativo ? '' : ', inativo'}`}
              >
                <View style={styles.cardTopo}>
                  <Text style={[styles.cardNome, !item.ativo && styles.textoInativo]}>{item.nome}</Text>
                  {!item.ativo && (
                    <View style={styles.badgeInativo}>
                      <Text style={styles.badgeInativoTexto}>inativo</Text>
                    </View>
                  )}
                </View>
                {item.descricao ? (
                  <Text style={[styles.cardDescricao, !item.ativo && styles.textoInativo]} numberOfLines={2}>
                    {item.descricao}
                  </Text>
                ) : null}
                <View style={styles.cardCustoRow}>
                  <Trophy size={12} color={item.ativo ? colors.accent.admin : colors.text.muted} strokeWidth={2} />
                  <Text style={[styles.cardCusto, !item.ativo && styles.textoInativo]}>
                    {item.custo_pontos} pts
                  </Text>
                </View>
              </Pressable>

              <HeaderIconButton
                icon={Pencil}
                onPress={() => router.push(`/(admin)/prizes/${item.id}` as never)}
                accessibilityLabel={`Editar prêmio ${item.nome}`}
              />
            </View>
          )}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    feedbackWrapper: {
      paddingHorizontal: spacing['4'],
      paddingTop: spacing['4'],
    },
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['12'] },
    resumo: { fontSize: typography.size.xs, color: colors.text.muted, marginBottom: spacing['1'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['3'],
      flexDirection: 'row',
      alignItems: 'center',
      ...shadows.card,
    },
    cardInativo: { opacity: 0.55 },
    cardMain: { flex: 1, gap: spacing['2'] },
    cardTopo: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    cardNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary, flex: 1 },
    textoInativo: { color: colors.text.muted },
    cardDescricao: { fontSize: typography.size.sm, color: colors.text.secondary },
    cardCustoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardCusto: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.admin },
    badgeInativo: {
      backgroundColor: colors.bg.muted,
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    badgeInativoTexto: { fontSize: typography.size.xs, color: colors.text.muted, fontFamily: typography.family.semibold },
  });
}
