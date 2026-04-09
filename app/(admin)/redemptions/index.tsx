import { Alert, StyleSheet, Text, View, RefreshControl, Modal } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { CheckCircle2, Clock, Trophy, User, XCircle, House, ClipboardList, Users, Gift, ShoppingBag } from 'lucide-react-native';
import { HomeFooterBar, type FooterItem } from '@/components/ui/home-footer-bar';
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
import { Button } from '@/components/ui/button';
import { formatDate } from '@lib/utils';
import {
  useAdminRedemptions,
  useConfirmRedemption,
  useCancelRedemption,
  useProfile,
} from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';

const FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  { icon: ClipboardList, label: 'Tarefas', rota: '/(admin)/tasks' },
  { icon: Users, label: 'Filhos', rota: '/(admin)/children' },
  { icon: Gift, label: 'Prêmios', rota: '/(admin)/prizes' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(admin)/redemptions' },
];
type ConfirmModalState = {
  visible: boolean;
  type: 'confirm' | 'cancel';
  redemptionId: string;
  childName: string;
  childUserId: string | null;
  prizeName: string;
  points: number;
};

const MODAL_INITIAL: ConfirmModalState = {
  visible: false,
  type: 'confirm',
  redemptionId: '',
  childName: '',
  childUserId: null,
  prizeName: '',
  points: 0,
};

type RedemptionRowProps = Readonly<{
  item: RedemptionWithChildAndPrize;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  isLast: boolean;
}>;

function RedemptionRow({ item, colors, styles, isLast }: RedemptionRowProps) {
  const statusColor = getRedemptionStatusColor(item.status, colors);
  const StatusIcon = item.status === 'confirmado' ? CheckCircle2 : XCircle;
  return (
    <View
      style={[
        styles.resRow,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
      ]}
    >
      <View style={[styles.resRowIcon, { backgroundColor: statusColor + '20' }]}>
        <StatusIcon size={14} color={statusColor} strokeWidth={2} />
      </View>
      <View style={styles.resRowInfo}>
        <Text style={styles.resRowPremio}>{item.premios.nome}</Text>
        <Text style={styles.resRowFilho}>{item.filhos.nome}</Text>
      </View>
      <View style={styles.resRowRight}>
        <Text style={[styles.resRowStatus, { color: statusColor }]}>
          {getRedemptionStatusLabel(item.status)}
        </Text>
        <Text style={styles.resRowData}>{formatDate(new Date(item.created_at))}</Text>
      </View>
    </View>
  );
}

export default function AdminRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
  const pendingRedemptions = useMemo(
    () => redemptions.filter((r) => r.status === 'pendente'),
    [redemptions],
  );
  const historicalRedemptions = useMemo(
    () => redemptions.filter((r) => r.status !== 'pendente'),
    [redemptions],
  );
  const { data: profile } = useProfile();
  const confirmMutation = useConfirmRedemption();
  const cancelMutation = useCancelRedemption();

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(actionSuccess);
  const [modal, setModal] = useState<ConfirmModalState>(MODAL_INITIAL);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const hasError = Boolean(error);
  const shouldShowEmptyState = hasError || redemptions.length === 0;

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(admin)/redemptions') return;
      if (rota === 'index') router.back();
      else router.replace(rota as never);
    },
    [router],
  );

  const handleConfirm = (
    redemptionId: string,
    childName: string,
    childUserId: string | null,
    prizeName: string,
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setModal({
      visible: true,
      type: 'confirm',
      redemptionId,
      childName,
      childUserId,
      prizeName,
      points: 0,
    });
  };

  const handleCancel = (
    redemptionId: string,
    childName: string,
    prizeName: string,
    points: number,
  ) => {
    setActionError(null);
    setActionSuccess(null);
    setModal({
      visible: true,
      type: 'cancel',
      redemptionId,
      childName,
      childUserId: null,
      prizeName,
      points,
    });
  };

  const executeModalAction = (redemptionId: string, type: 'confirm' | 'cancel') => {
    if (!profile) return;
    setProcessingId(redemptionId);

    if (type === 'confirm') {
      confirmMutation.mutate(
        {
          redemptionId,
          opts: {
            familiaId: profile.familia_id,
            userId: modal.childUserId,
            prizeName: modal.prizeName,
          },
        },
        {
          onSuccess: () => {
            setProcessingId(null);
            setActionSuccess('Resgate confirmado com sucesso.');
          },
          onError: (err) => {
            setProcessingId(null);
            setActionError(err.message);
          },
        },
      );
    } else {
      cancelMutation.mutate(
        {
          redemptionId,
          opts: modal.childUserId
            ? {
                familiaId: profile.familia_id,
                userId: modal.childUserId,
                prizeName: modal.prizeName,
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
            setActionError(err.message);
          },
        },
      );
    }
  };

  const handleModalConfirm = () => {
    const { redemptionId, type, points } = modal;
    setModal(MODAL_INITIAL);

    if (type === 'cancel') {
      Alert.alert('Cancelar resgate?', `Os ${points} pts debitados serão estornados.`, [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar resgate',
          style: 'destructive',
          onPress: () => executeModalAction(redemptionId, type),
        },
      ]);
      return;
    }

    executeModalAction(redemptionId, type);
  };

  return (
    <SafeScreenFrame bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" onBack={() => router.back()} backLabel="Início" />

      {isLoading ? (
        <ListScreenSkeleton />
      ) : shouldShowEmptyState ? (
        <EmptyState
          error={error?.message ?? null}
          empty={!error}
          emptyMessage="Nenhum resgate registrado ainda."
          onRetry={() => refetch()}
        />
      ) : (
        <FlashList
          data={historicalRedemptions}
          keyExtractor={(item) => item.id}
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
              <View style={{ height: spacing['4'] }} />
              {visibleSuccess ? <InlineMessage message={visibleSuccess} variant="success" /> : null}
              {actionError ? <InlineMessage message={actionError} variant="error" /> : null}
              {pendingRedemptions.length > 0 && (
                <>
                  <View style={[styles.historicoHeader, { borderBottomColor: colors.border.subtle }]}>
                    <View style={styles.secaoTituloRow}>
                      <Clock size={14} color={colors.text.primary} strokeWidth={2} />
                      <Text style={styles.secaoTitulo}>
                        Pendentes ({pendingRedemptions.length})
                      </Text>
                    </View>
                  </View>
                  {pendingRedemptions.map((item) => {
                    const isProcessing = processingId === item.id;
                    return (
                      <View key={item.id} style={[styles.card, styles.cardPendente]}>
                        <View style={styles.cardTopo}>
                          <View style={{ flex: 1, gap: spacing['1'] }}>
                            <Text style={[styles.premioNome, { color: colors.text.primary }]}>
                              {item.premios.nome}
                            </Text>
                            <View style={styles.cardFilhoRow}>
                              <User size={12} color={colors.text.secondary} strokeWidth={2} />
                              <Text style={styles.cardFilho}>{item.filhos.nome}</Text>
                            </View>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <View
                              style={[
                                styles.statusBadge,
                                {
                                  backgroundColor:
                                    getRedemptionStatusColor(item.status, colors) + '22',
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.statusTexto,
                                  { color: getRedemptionStatusColor(item.status, colors) },
                                ]}
                              >
                                {getRedemptionStatusLabel(item.status)}
                              </Text>
                            </View>
                            <Text style={styles.cardData}>
                              {formatDate(new Date(item.created_at))}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.cardPontosRow}>
                          <Trophy size={12} color={colors.accent.admin} strokeWidth={2} />
                          <Text style={styles.cardPontos}>{item.pontos_debitados} pts</Text>
                        </View>
                        <View style={styles.acoesRow}>
                          <View style={{ flex: 1 }}>
                            <Button
                              variant="primary"
                              size="sm"
                              label="Confirmar"
                              loading={isProcessing}
                              disabled={isProcessing}
                              onPress={() =>
                                handleConfirm(
                                  item.id,
                                  item.filhos.nome,
                                  item.filhos.usuario_id,
                                  item.premios.nome,
                                )
                              }
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Button
                              variant="danger"
                              size="sm"
                              label="Cancelar"
                              disabled={isProcessing}
                              onPress={() =>
                                handleCancel(
                                  item.id,
                                  item.filhos.nome,
                                  item.premios.nome,
                                  item.pontos_debitados,
                                )
                              }
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}
              {historicalRedemptions.length > 0 && (
                <View style={[styles.historicoHeader, { borderBottomColor: colors.border.subtle }]}>
                  <Text style={styles.secaoTitulo}>Histórico</Text>
                </View>
              )}
              {redemptions.length > 0 &&
              historicalRedemptions.length === 0 &&
              !isFetching ? (
                <Text style={styles.semHistorico}>Nenhum histórico de resgates.</Text>
              ) : null}
            </>
          }
          renderItem={({ item, index }) => (
            <RedemptionRow
              item={item}
              colors={colors}
              styles={styles}
              isLast={index === historicalRedemptions.length - 1}
            />
          )}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.3}
          ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
        />
      )}

      <Modal visible={modal.visible} transparent animationType="fade" onRequestClose={() => setModal(MODAL_INITIAL)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>
              {modal.type === 'confirm' ? 'Confirmar entrega' : 'Cancelar resgate'}
            </Text>
            <Text style={styles.modalMessage}>
              {modal.type === 'confirm'
                ? `Confirmar entrega do prêmio "${modal.prizeName}" para ${modal.childName}?`
                : `Cancelar o resgate de "${modal.prizeName}" de ${modal.childName}? Os ${modal.points} pts serão estornados.`}
            </Text>
            <View style={styles.modalBtns}>
              <View style={{ flex: 1 }}>
                <Button
                  variant="outline"
                  size="sm"
                  label="Voltar"
                  onPress={() => setModal(MODAL_INITIAL)}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant={modal.type === 'confirm' ? 'primary' : 'danger'}
                  size="sm"
                  label={modal.type === 'confirm' ? 'Confirmar' : 'Cancelar resgate'}
                  onPress={handleModalConfirm}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>
      <HomeFooterBar items={FOOTER_ITEMS} activeRoute="/(admin)/redemptions" onNavigate={handleFooterNavigate} />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { paddingHorizontal: spacing['4'] },
    secaoTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    historicoHeader: {
      borderBottomWidth: 1,
      paddingBottom: spacing['3'],
      marginTop: spacing['2'],
      marginBottom: spacing['1'],
    },
    secaoTituloRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
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
    cardPendente: { borderLeftWidth: 3, borderLeftColor: colors.semantic.warning },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['2'] },
    premioNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    cardFilhoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardFilho: { fontSize: typography.size.xs, color: colors.text.secondary },
    alertaIcone: { fontSize: typography.size['2xl'], marginBottom: spacing['2'] },
    statusBadge: {
      borderRadius: radii.md,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    cardData: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      marginTop: spacing['1'],
    },
    cardPontosRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardPontos: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.accent.admin,
    },
    dataSolicitacao: { fontSize: typography.size.xs, color: colors.text.muted },
    acoesRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['1'] },
    semHistorico: {
      fontSize: typography.size.sm,
      color: colors.text.muted,
      fontStyle: 'italic',
      padding: spacing['3'],
    },
    resRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['3'],
      gap: spacing['2'],
    },
    resRowIcon: {
      width: 30,
      height: 30,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resRowInfo: { flex: 1 },
    resRowPremio: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    resRowFilho: {
      fontSize: typography.size.xs,
      color: colors.text.secondary,
      marginTop: spacing['0.5'],
    },
    resRowRight: { alignItems: 'flex-end' },
    resRowStatus: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    resRowData: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      marginTop: spacing['0.5'],
    },
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.overlay.scrimSoft,
      padding: spacing['6'],
    },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['6'],
      width: '100%',
      gap: spacing['4'],
    },
    modalTitle: {
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    modalMessage: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.md,
    },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
  });
}
