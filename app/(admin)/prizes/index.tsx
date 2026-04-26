import { StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Pencil, Plus, Star } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useAdminFooterItems } from '@/hooks/use-footer-items';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { InlineMessage } from '@/components/ui/inline-message';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';
import { PrizeFormSheet } from '@/components/prizes/prize-form-sheet';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { consumeNavigationFeedback, type NavigationFeedback } from '@lib/navigation-feedback';
import { usePrizes, usePrizeDetail } from '@/hooks/queries';
import type { Prize } from '@lib/prizes';

type TabKey = 'ativos' | 'arquivados' | 'todos';

export default function AdminPrizesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useAdminFooterItems();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePrizes();
  const allPrizes = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const [tab, setTab] = useState<TabKey>('ativos');
  const [showCreate, setShowCreate] = useState(false);
  const [editPrizeId, setEditPrizeId] = useState<string | null>(null);
  const [successFeedback, setSuccessFeedback] = useState<NavigationFeedback | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; key: number } | null>(
    null,
  );
  const visibleSuccessMessage = useTransientMessage(successFeedback?.message ?? null, {
    resetKey: successFeedback?.id,
  });
  const visibleAction = useTransientMessage(actionFeedback?.message ?? null, {
    resetKey: actionFeedback?.key,
  });

  const editPrizeQuery = usePrizeDetail(editPrizeId ?? undefined);

  useFocusEffect(
    useCallback(() => {
      const feedback = consumeNavigationFeedback('admin-prize-list');
      if (feedback) setSuccessFeedback(feedback);
    }, []),
  );

  const visible: Prize[] = useMemo(() => {
    if (tab === 'ativos') return allPrizes.filter((p) => p.ativo);
    if (tab === 'arquivados') return allPrizes.filter((p) => !p.ativo);
    return allPrizes;
  }, [allPrizes, tab]);

  const activeCount = useMemo(() => allPrizes.filter((p) => p.ativo).length, [allPrizes]);
  const archivedCount = useMemo(() => allPrizes.filter((p) => !p.ativo).length, [allPrizes]);

  const hasError = Boolean(error);
  const shouldShowEmptyState = hasError || visible.length === 0;
  const emptyStateMessage =
    tab === 'arquivados'
      ? 'Nenhum prêmio arquivado.'
      : 'Nenhum prêmio cadastrado.\nToque em "+" para criar.';

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(admin)/prizes') return;
      if (rota === 'index') router.dismissTo('/(admin)');
      else router.replace(rota as never);
    },
    [router],
  );

  const tabs: SegmentOption<TabKey>[] = useMemo(
    () => [
      { key: 'ativos', label: 'Ativos', badge: activeCount },
      { key: 'arquivados', label: 'Arquivados', badge: archivedCount },
      { key: 'todos', label: 'Todos', badge: allPrizes.length },
    ],
    [activeCount, archivedCount, allPrizes.length],
  );

  const renderContent = () => {
    if (isLoading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState) {
      return (
        <EmptyState
          error={error?.message ?? null}
          empty={!error}
          emptyMessage={emptyStateMessage}
          onRetry={() => refetch()}
        />
      );
    }
    return (
      <FlashList
        data={visible}
        keyExtractor={(item) => item.id}
        numColumns={2}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={<View style={{ height: spacing['3'] }} />}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.card,
              { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              !item.ativo && styles.cardArquivado,
              pressed && { opacity: 0.9, transform: [{ scale: 0.97 }] },
            ]}
            onPress={() => setEditPrizeId(item.id)}
            accessibilityRole="button"
            accessibilityLabel={`${item.nome}, ${item.custo_pontos} pontos${item.ativo ? '' : ', arquivado'}`}
          >
            <Text style={styles.emoji}>{item.emoji || '🎁'}</Text>
            <Text
              style={[styles.cardNome, { color: colors.text.primary }]}
              numberOfLines={2}
            >
              {item.nome}
            </Text>
            <View style={[styles.costBadge, { backgroundColor: colors.accent.adminBg }]}>
              <Star size={12} color={colors.accent.admin} strokeWidth={2} />
              <Text style={[styles.costText, { color: colors.accent.admin }]}>
                {item.custo_pontos}
              </Text>
            </View>
            {item.estoque === 0 ? (
              <Text style={[styles.stockText, { color: colors.text.muted }]}>Esgotado</Text>
            ) : item.estoque <= 3 ? (
              <Text style={[styles.stockText, { color: colors.semantic.warningText }]}>
                Só {item.estoque} restantes
              </Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.editBtn,
                { backgroundColor: colors.bg.muted },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => setEditPrizeId(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Editar prêmio ${item.nome}`}
            >
              <Pencil size={12} color={colors.text.primary} strokeWidth={2} />
              <Text style={[styles.editBtnText, { color: colors.text.primary }]}>Editar</Text>
            </Pressable>
          </Pressable>
        )}
        onEndReached={() => {
          if (hasNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Prêmios"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => setShowCreate(true)}
            accessibilityLabel="Criar prêmio"
            tone="accent"
          />
        }
      />

      <SegmentedBar options={tabs} value={tab} onChange={setTab} role="admin" />

      {visibleSuccessMessage ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleSuccessMessage} variant="success" />
        </View>
      ) : null}

      {visibleAction ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleAction} variant="success" />
        </View>
      ) : null}

      {renderContent()}
      <HomeFooterBar
        items={footerItems}
        activeRoute="/(admin)/prizes"
        onNavigate={handleFooterNavigate}
      />

      <PrizeFormSheet
        visible={showCreate}
        mode="create"
        onClose={() => setShowCreate(false)}
        onSuccess={(message) => setActionFeedback({ message, key: Date.now() })}
      />

      <PrizeFormSheet
        visible={editPrizeId !== null && !!editPrizeQuery.data}
        mode="edit"
        prize={editPrizeQuery.data ?? null}
        onClose={() => setEditPrizeId(null)}
        onSuccess={(message) => setActionFeedback({ message, key: Date.now() })}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    feedbackWrapper: {
      paddingHorizontal: spacing['4'],
      paddingTop: spacing['3'],
    },
    lista: { paddingHorizontal: spacing['3'] },
    card: {
      flex: 1,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['4'],
      alignItems: 'center',
      marginHorizontal: spacing['1'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    cardArquivado: { opacity: 0.55 },
    emoji: { fontSize: 36, marginBottom: spacing['2'] },
    cardNome: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      textAlign: 'center',
      marginBottom: spacing['2'],
      minHeight: 40,
    },
    costBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
      marginBottom: spacing['2'],
    },
    costText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.black,
    },
    stockText: {
      fontSize: 10,
      fontFamily: typography.family.medium,
      marginBottom: spacing['2'],
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1'],
      width: '100%',
      paddingVertical: spacing['2'],
      borderRadius: radii.md,
    },
    editBtnText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
  });
}
