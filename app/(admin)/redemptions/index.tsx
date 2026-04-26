import { Alert, Pressable, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { localizeRpcError } from '@lib/api-error';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Star, Check, X } from 'lucide-react-native';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useAdminFooterItems } from '@/hooks/use-footer-items';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@lib/status';
import type { RedemptionWithChildAndPrize } from '@lib/redemptions';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';
import { formatDate } from '@lib/utils';
import {
  useAdminRedemptions,
  useConfirmRedemption,
  useCancelRedemption,
  useProfile,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';

type TabKey = 'pendentes' | 'concluidos' | 'todos';

export default function AdminRedemptionsScreen() {
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
  } = useAdminRedemptions();
  const redemptions = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  const { data: profile } = useProfile();
  const confirmMutation = useConfirmRedemption();
  const cancelMutation = useCancelRedemption();

  const [tab, setTab] = useState<TabKey>('pendentes');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(actionSuccess);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => redemptions.filter((r) => r.status === 'pendente').length,
    [redemptions],
  );

  const filtered = useMemo(() => {
    if (tab === 'pendentes') return redemptions.filter((r) => r.status === 'pendente');
    if (tab === 'concluidos') return redemptions.filter((r) => r.status !== 'pendente');
    return redemptions;
  }, [redemptions, tab]);

  const hasError = Boolean(error);
  const shouldShowEmptyState = hasError || filtered.length === 0;

  const emptyMessages: Record<TabKey, string> = {
    pendentes: 'Nenhum resgate pendente.',
    concluidos: 'Nenhum resgate concluído.',
    todos: 'Nenhum resgate registrado.',
  };

  const concludedCount = useMemo(
    () => redemptions.filter((r) => r.status !== 'pendente').length,
    [redemptions],
  );

  const tabs: SegmentOption<TabKey>[] = useMemo(
    () => [
      { key: 'pendentes', label: 'Pendentes', badge: pendingCount },
      { key: 'concluidos', label: 'Concluídos', badge: concludedCount },
      { key: 'todos', label: 'Todos', badge: redemptions.length },
    ],
    [pendingCount, concludedCount, redemptions.length],
  );

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(admin)/redemptions') return;
      if (rota === 'index') router.dismissTo('/(admin)');
      else router.replace(rota as never);
    },
    [router],
  );

  const handleConfirm = useCallback((item: RedemptionWithChildAndPrize) => {
    if (!profile) return;
    Alert.alert(
      'Confirmar entrega',
      `Confirmar entrega do prêmio "${item.premios.nome}" para ${item.filhos.nome}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            setActionError(null);
            setActionSuccess(null);
            setProcessingId(item.id);
            confirmMutation.mutate(
              {
                redemptionId: item.id,
                opts: {
                  familiaId: profile.familia_id,
                  userId: item.filhos.usuario_id,
                  prizeName: item.premios.nome,
                },
              },
              {
                onSuccess: () => {
                  setProcessingId(null);
                  setActionSuccess('Resgate confirmado com sucesso.');
                },
                onError: (err) => {
                  setProcessingId(null);
                  setActionError(localizeRpcError(err.message));
                },
              },
            );
          },
        },
      ],
    );
  }, [profile, confirmMutation]);

  const handleCancel = useCallback((item: RedemptionWithChildAndPrize) => {
    if (!profile) return;
    Alert.alert(
      'Cancelar resgate?',
      `Os ${item.pontos_debitados} pts debitados serão estornados.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar resgate',
          style: 'destructive',
          onPress: () => {
            setActionError(null);
            setActionSuccess(null);
            setProcessingId(item.id);
            cancelMutation.mutate(
              {
                redemptionId: item.id,
                opts: item.filhos.usuario_id
                  ? {
                    familiaId: profile.familia_id,
                    userId: item.filhos.usuario_id,
                    prizeName: item.premios.nome,
                  }
                  : undefined,
              },
              {
                onSuccess: () => {
                  setProcessingId(null);
                  setActionSuccess('Resgate cancelado. Pontos estornados.');
                },
                onError: (err) => {
                  setProcessingId(null);
                  setActionError(localizeRpcError(err.message));
                },
              },
            );
          },
        },
      ],
    );
  }, [profile, cancelMutation]);

  const renderItem = useCallback(
    ({ item }: { item: RedemptionWithChildAndPrize }) => {
      const statusColor = getRedemptionStatusColor(item.status, colors);
      const isPendente = item.status === 'pendente';
      const isProcessing = processingId === item.id;

      return (
        <View style={styles.card}>
          {/* Top row: emoji + info + cost badge */}
          <View style={styles.topRow}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emojiText}>{item.premios.emoji || '🎁'}</Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.prizeName} numberOfLines={1}>
                {item.premios.nome}
              </Text>
              <Text style={styles.childDate} numberOfLines={1}>
                {item.filhos.nome} · {formatDate(new Date(item.created_at))}
              </Text>
            </View>
            <View style={[styles.costBadge, { backgroundColor: colors.accent.adminBg }]}>
              <Star size={12} color={colors.accent.admin} strokeWidth={2} />
              <Text style={[styles.costText, { color: colors.accent.admin }]}>
                {item.pontos_debitados}
              </Text>
            </View>
          </View>

          {/* Bottom row: status badge + action buttons */}
          <View style={styles.bottomRow}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22' }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {getRedemptionStatusLabel(item.status)}
              </Text>
            </View>

            {isPendente && (
              <View style={styles.actionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.btnReject,
                    { backgroundColor: colors.semantic.errorBg },
                    pressed && { opacity: 0.7 },
                  ]}
                  onPress={() => handleCancel(item)}
                  disabled={isProcessing}
                  accessibilityRole="button"
                  accessibilityLabel={`Recusar resgate de ${item.premios.nome}`}
                >
                  <X size={16} color={colors.semantic.error} strokeWidth={2.5} />
                </Pressable>
                <Pressable
                  style={({ pressed }) => [
                    styles.btnApprove,
                    { backgroundColor: colors.accent.admin },
                    pressed && { opacity: 0.85 },
                  ]}
                  onPress={() => handleConfirm(item)}
                  disabled={isProcessing}
                  accessibilityRole="button"
                  accessibilityLabel={`Aprovar resgate de ${item.premios.nome}`}
                >
                  <Check size={14} color={colors.text.inverse} strokeWidth={2.5} />
                  <Text style={[styles.btnApproveText, { color: colors.text.inverse }]}>
                    Aprovar
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      );
    },
    [colors, styles, processingId, handleConfirm, handleCancel],
  );

  const renderContent = () => {
    if (isLoading) return <ListScreenSkeleton />;
    if (shouldShowEmptyState) {
      return (
        <EmptyState
          error={error?.message ?? null}
          empty={!error}
          emptyMessage={emptyMessages[tab]}
          onRetry={() => refetch()}
        />
      );
    }
    return (
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={() => refetch()}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={
          <>
            <View style={{ height: spacing['3'] }} />
            {visibleSuccess ? <InlineMessage message={visibleSuccess} variant="success" /> : null}
            {actionError ? <InlineMessage message={actionError} variant="error" /> : null}
          </>
        }
        renderItem={renderItem}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" />
      <SegmentedBar options={tabs} value={tab} onChange={setTab} role="admin" />
      {renderContent()}
      <HomeFooterBar
        items={footerItems}
        activeRoute="/(admin)/redemptions"
        onNavigate={handleFooterNavigate}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.subtle,
      padding: spacing['4'],
      gap: spacing['3'],
      marginBottom: spacing['3'],
      ...shadows.card,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    emojiCircle: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      backgroundColor: colors.bg.muted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiText: {
      fontSize: 22,
    },
    infoCol: {
      flex: 1,
      gap: spacing['0.5'],
    },
    prizeName: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    childDate: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      color: colors.text.muted,
    },
    costBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    costText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.black,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    statusBadge: {
      borderRadius: radii.md,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    statusText: {
      fontSize: 10,
      fontFamily: typography.family.bold,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    btnReject: {
      width: 36,
      height: 36,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnApprove: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      height: 36,
      paddingHorizontal: spacing['4'],
      borderRadius: radii.lg,
    },
    btnApproveText: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
    },
  });
}
