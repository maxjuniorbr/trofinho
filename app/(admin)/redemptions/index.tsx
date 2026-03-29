import {
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
  RefreshControl,
  Modal,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  Clock,
  Trophy,
  User,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import { getRedemptionStatusColor, getRedemptionStatusLabel } from '@/constants/status';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { formatDate } from '@lib/utils';
import { useAdminRedemptions, useConfirmRedemption, useCancelRedemption, useProfile } from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';

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

export default function AdminRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: redemptions = [], isLoading, error, refetch } = useAdminRedemptions();
  const { data: profile } = useProfile();
  const confirmMutation = useConfirmRedemption();
  const cancelMutation = useCancelRedemption();

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(actionSuccess);
  const [modal, setModal] = useState<ConfirmModalState>(MODAL_INITIAL);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const hasError = Boolean(error);
  const shouldShowEmptyState = isLoading || hasError || redemptions.length === 0;

  const handleConfirm = (redemptionId: string, childName: string, childUserId: string | null, prizeName: string) => {
    setActionError(null);
    setActionSuccess(null);
    setModal({ visible: true, type: 'confirm', redemptionId, childName, childUserId, prizeName, points: 0 });
  };

  const handleCancel = (redemptionId: string, childName: string, prizeName: string, points: number) => {
    setActionError(null);
    setActionSuccess(null);
    setModal({ visible: true, type: 'cancel', redemptionId, childName, childUserId: null, prizeName, points });
  };

  const executeModalAction = (redemptionId: string, type: 'confirm' | 'cancel') => {
    setProcessingId(redemptionId);

    if (type === 'confirm') {
      confirmMutation.mutate({
        redemptionId,
        opts: modal.childUserId && profile ? {
          familiaId: profile.familia_id,
          userId: modal.childUserId,
          prizeName: modal.prizeName,
        } : undefined,
      }, {
        onSuccess: () => { setProcessingId(null); setActionSuccess('Resgate confirmado com sucesso.'); },
        onError: (err) => { setProcessingId(null); setActionError(err.message); },
      });
    } else {
      cancelMutation.mutate(redemptionId, {
        onSuccess: () => { setProcessingId(null); setActionSuccess('Resgate cancelado. Pontos estornados.'); },
        onError: (err) => { setProcessingId(null); setActionError(err.message); },
      });
    }
  };

  const handleModalConfirm = () => {
    const { redemptionId, type, points } = modal;
    setModal(MODAL_INITIAL);

    if (type === 'cancel') {
      Alert.alert(
        'Cancelar resgate?',
        `Os ${points} pts debitados serão estornados.`,
        [
          { text: 'Voltar', style: 'cancel' },
          {
            text: 'Cancelar resgate',
            style: 'destructive',
            onPress: () => executeModalAction(redemptionId, type),
          },
        ],
      );
      return;
    }

    executeModalAction(redemptionId, type);
  };

  const pending = redemptions.filter((r) => r.status === 'pendente');

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" onBack={() => router.back()} backLabel="Início" />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={isLoading}
          error={error?.message ?? null}
          empty={!isLoading && !error}
          emptyMessage="Nenhum resgate registrado ainda."
          onRetry={() => refetch()}
        />
      ) : (
        <FlashList
          data={redemptions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => refetch()} tintColor={colors.brand.vivid} />}
          ListHeaderComponent={
            <>
              {visibleSuccess ? <InlineMessage message={visibleSuccess} variant="success" /> : null}
              {actionError ? <InlineMessage message={actionError} variant="error" /> : null}
              {pending.length > 0 && (
                <View style={styles.secaoHeader}>
                  <View style={styles.secaoTituloRow}>
                    <Clock size={14} color={colors.text.muted} strokeWidth={2} />
                    <Text style={styles.secaoTitulo}>Pendentes ({pending.length})</Text>
                  </View>
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => {
            const isPending = item.status === 'pendente';
            const isProcessing = processingId === item.id;
            const previousPending = index > 0 && redemptions[index - 1]?.status === 'pendente';
            const showHistorySeparator = !isPending && (index === 0 || previousPending);

            return (
              <>
                {showHistorySeparator ? (
                  <View style={styles.secaoHeader}>
                    <Text style={styles.secaoTitulo}>Histórico</Text>
                  </View>
                ) : null}
                <View style={[styles.card, isPending && styles.cardPendente]}>
                  <View style={styles.cardTopo}>
                    <View style={{ flex: 1, gap: spacing['1'] }}>
                    <Text style={[styles.premioNome, { color: colors.text.primary }]}>{item.premios.nome}</Text>
                      <View style={styles.cardFilhoRow}>
                        <User size={12} color={colors.text.secondary} strokeWidth={2} />
                        <Text style={styles.cardFilho}>{item.filhos.nome}</Text>
                      </View>
                    </View>
                    <View>
                      <View style={[styles.statusBadge, { backgroundColor: getRedemptionStatusColor(item.status, colors) + '22' }]}>
                        <Text style={[styles.statusTexto, { color: getRedemptionStatusColor(item.status, colors) }]}>
                          {getRedemptionStatusLabel(item.status)}
                        </Text>
                      </View>
                      <Text style={styles.cardData}>{formatDate(new Date(item.created_at))}</Text>
                    </View>
                  </View>

                  <View style={styles.cardPontosRow}>
                    <Trophy size={12} color={colors.accent.admin} strokeWidth={2} />
                    <Text style={styles.cardPontos}>{item.pontos_debitados} pts</Text>
                  </View>

                  {isPending ? (
                    <View style={styles.acoesRow}>
                      <Pressable
                        style={({ pressed }) => [styles.botaoConfirmar, isProcessing && styles.botaoDesabilitado, pressed && !isProcessing && { opacity: 0.85 }]}
                        onPress={() => handleConfirm(item.id, item.filhos.nome, item.filhos.usuario_id, item.premios.nome)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Text style={styles.botaoConfirmarTexto}>…</Text> : (
                          <View style={styles.botaoInner}>
                            <CheckCircle2 size={14} color={colors.text.inverse} strokeWidth={2} />
                            <Text style={styles.botaoConfirmarTexto}>Confirmar</Text>
                          </View>
                        )}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.botaoCancelar, isProcessing && styles.botaoDesabilitado, pressed && !isProcessing && { opacity: 0.85 }]}
                        onPress={() => handleCancel(item.id, item.filhos.nome, item.premios.nome, item.pontos_debitados)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Text style={styles.botaoCancelarTexto}>…</Text> : (
                          <View style={styles.botaoInner}>
                            <XCircle size={14} color={colors.semantic.error} strokeWidth={2} />
                            <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
                          </View>
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </>
            );
          }}
        />
      )}

      <Modal visible={modal.visible} transparent animationType="fade">
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
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setModal(MODAL_INITIAL)}
              >
                <Text style={styles.modalCancelBtnText}>Voltar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirmBtn,
                  { backgroundColor: modal.type === 'confirm' ? colors.semantic.success : colors.semantic.error },
                ]}
                onPress={handleModalConfirm}
              >
                <Text style={styles.modalConfirmBtnText}>
                  {modal.type === 'confirm' ? 'Confirmar' : 'Cancelar resgate'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], paddingBottom: spacing['12'] },
    secaoHeader: { paddingVertical: spacing['2'] },
    secaoTituloRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    secaoTitulo: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
      marginBottom: spacing['2'],
      ...shadows.card,
    },
    cardPendente: { borderLeftWidth: 3, borderLeftColor: colors.semantic.warning },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['2'] },
    premioNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    cardFilhoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardFilho: { fontSize: typography.size.xs, color: colors.text.secondary },
    alertaIcone: { fontSize: typography.size['2xl'], marginBottom: spacing['2'] },
    statusBadge: { borderRadius: radii.md, borderCurve: 'continuous', paddingHorizontal: spacing['2'], paddingVertical: spacing['1'], alignSelf: 'flex-end' },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    cardData: { fontSize: typography.size.xs, color: colors.text.muted, textAlign: 'right', marginTop: spacing['1'] },
    cardPontosRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    cardPontos: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.admin },
    dataSolicitacao: { fontSize: typography.size.xs, color: colors.text.muted },
    acoesRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['1'] },
    botaoInner: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    botaoConfirmar: { flex: 1, backgroundColor: colors.semantic.success, borderRadius: radii.lg, borderCurve: 'continuous', paddingVertical: spacing['2'], alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    botaoConfirmarTexto: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoCancelar: { flex: 1, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: colors.semantic.error, paddingVertical: spacing['2'], alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    botaoCancelarTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.overlay.scrimSoft, padding: spacing['6'] },
    modalBox: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['6'],
      width: '100%',
      gap: spacing['4'],
    },
    modalTitle: { fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary },
    modalMessage: { fontSize: typography.size.sm, color: colors.text.secondary, lineHeight: typography.lineHeight.md },
    modalBtns: { flexDirection: 'row', gap: spacing['3'] },
    modalCancelBtn: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    modalCancelBtnText: { color: colors.text.secondary, fontFamily: typography.family.semibold, fontSize: typography.size.sm },
    modalConfirmBtn: {
      flex: 1,
      borderRadius: radii.xl,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    modalConfirmBtnText: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.sm },
  });
}
