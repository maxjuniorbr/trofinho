import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Clock,
  Trophy,
  User,
  CheckCircle2,
  XCircle,
} from 'lucide-react-native';
import {
  listRedemptions,
  confirmRedemption,
  cancelRedemption,
  getRedemptionStatusLabel,
  getRedemptionStatusColor,
  type RedemptionWithChildAndPrize,
} from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { formatDate } from '@lib/utils';

type ConfirmModalState = {
  visible: boolean;
  type: 'confirm' | 'cancel';
  redemptionId: string;
  childName: string;
  prizeName: string;
  points: number;
};

const MODAL_INITIAL: ConfirmModalState = {
  visible: false,
  type: 'confirm',
  redemptionId: '',
  childName: '',
  prizeName: '',
  points: 0,
};

export default function AdminRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [redemptions, setRedemptions] = useState<RedemptionWithChildAndPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modal, setModal] = useState<ConfirmModalState>(MODAL_INITIAL);
  const hasError = Boolean(error);
  const hasActionError = Boolean(actionError);
  const shouldShowEmptyState = loading || hasError || redemptions.length === 0;

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setActionError(null);
    try {
      const { data, error } = await listRedemptions();
      if (error) setError(error);
      else setRedemptions(data);
    } catch {
      setError('Não foi possível carregar os resgates agora.');
      setRedemptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  function handleConfirm(redemptionId: string, childName: string, prizeName: string) {
    setActionError(null);
    setModal({ visible: true, type: 'confirm', redemptionId, childName, prizeName, points: 0 });
  }

  function handleCancel(redemptionId: string, childName: string, prizeName: string, points: number) {
    setActionError(null);
    setModal({ visible: true, type: 'cancel', redemptionId, childName, prizeName, points });
  }

  async function handleModalConfirm() {
    setProcessing(modal.redemptionId);
    setModal(MODAL_INITIAL);
    if (modal.type === 'confirm') {
      const { error } = await confirmRedemption(modal.redemptionId);
      setProcessing(null);
      if (error) setActionError(error);
      else loadData();
    } else {
      const { error } = await cancelRedemption(modal.redemptionId);
      setProcessing(null);
      if (error) setActionError(error);
      else loadData();
    }
  }

  const pending = redemptions.filter((r) => r.status === 'pendente');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" onBack={() => router.back()} backLabel="Início" />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={loading}
          error={error}
          empty={!loading && !error}
          emptyMessage="Nenhum resgate registrado ainda."
          onRetry={loadData}
        />
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          ListHeaderComponent={
            <>
              {hasActionError ? <Text style={styles.erroAcao}>{actionError}</Text> : null}
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
            const isProcessing = processing === item.id;
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
                      <View style={[styles.statusBadge, { backgroundColor: getRedemptionStatusColor(item.status) + '22' }]}>
                        <Text style={[styles.statusTexto, { color: getRedemptionStatusColor(item.status) }]}>
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
                        onPress={() => handleConfirm(item.id, item.filhos.nome, item.premios.nome)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? <Text style={styles.botaoConfirmarTexto}>…</Text> : (
                          <View style={styles.botaoInner}>
                            <CheckCircle2 size={14} color="#fff" strokeWidth={2} />
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
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], gap: spacing['2'], paddingBottom: spacing['10'] },
    erroAcao: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium, marginBottom: spacing['2'], textAlign: 'center' },
    secaoHeader: { paddingVertical: spacing['2'] },
    secaoTituloRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    secaoTitulo: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
      ...shadows.card,
    },
    cardPendente: { borderLeftWidth: 3, borderLeftColor: colors.semantic.warning },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing['2'] },
    premioNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    cardFilhoRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardFilho: { fontSize: typography.size.xs, color: colors.text.secondary },
    alertaIcone: { fontSize: 24, marginBottom: spacing['2'] },
    statusBadge: { borderRadius: radii.md, borderCurve: 'continuous', paddingHorizontal: spacing['2'], paddingVertical: spacing['1'], alignSelf: 'flex-end' },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    cardData: { fontSize: typography.size.xs, color: colors.text.muted, textAlign: 'right', marginTop: spacing['1'] },
    cardPontosRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardPontos: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.admin },
    dataSolicitacao: { fontSize: typography.size.xs, color: colors.text.muted },
    acoesRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['1'] },
    botaoInner: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    botaoConfirmar: { flex: 1, backgroundColor: colors.semantic.success, borderRadius: radii.lg, borderCurve: 'continuous', paddingVertical: spacing['2'], alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    botaoConfirmarTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoCancelar: { flex: 1, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: colors.semantic.error, paddingVertical: spacing['2'], alignItems: 'center', justifyContent: 'center', minHeight: 44 },
    botaoCancelarTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
    modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', padding: spacing['6'] },
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
    modalConfirmBtnText: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.sm },
  });
}
