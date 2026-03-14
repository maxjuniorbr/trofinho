import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  listRedemptions,
  confirmRedemption,
  cancelRedemption,
  getRedemptionStatusLabel,
  getRedemptionStatusEmoji,
  getRedemptionStatusColor,
  type RedemptionWithChildAndPrize,
} from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { formatDate } from '@lib/utils';

export default function AdminRedemptionsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [redemptions, setRedemptions] = useState<RedemptionWithChildAndPrize[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
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

  async function handleConfirm(redemptionId: string, childName: string, prizeName: string) {
    setActionError(null);
    Alert.alert(
      'Confirmar entrega',
      `Confirmar entrega do prêmio "${prizeName}" para ${childName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setProcessing(redemptionId);
            const { error } = await confirmRedemption(redemptionId);
            setProcessing(null);
            if (error) setActionError(error);
            else loadData();
          },
        },
      ]
    );
  }

  async function handleCancel(redemptionId: string, childName: string, prizeName: string, points: number) {
    setActionError(null);
    Alert.alert(
      'Cancelar resgate',
      `Cancelar o resgate de "${prizeName}" de ${childName}? Os ${points} pts serão estornados.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar resgate',
          style: 'destructive',
          onPress: async () => {
            setProcessing(redemptionId);
            const { error } = await cancelRedemption(redemptionId);
            setProcessing(null);
            if (error) setActionError(error);
            else loadData();
          },
        },
      ]
    );
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
          ListHeaderComponent={
            <>
              {hasActionError ? <Text style={styles.erroAcao}>{actionError}</Text> : null}
              {pending.length > 0 && (
                <View style={styles.secaoHeader}>
                  <Text style={styles.secaoTitulo}>⏳ Pendentes ({pending.length})</Text>
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
                      <Text style={styles.cardFilho}>👤 {item.filhos.nome}</Text>
                    </View>
                    <View>
                      <View style={[styles.statusBadge, { backgroundColor: getRedemptionStatusColor(item.status) + '22' }]}>
                        <Text style={[styles.statusTexto, { color: getRedemptionStatusColor(item.status) }]}>
                          {getRedemptionStatusEmoji(item.status)} {getRedemptionStatusLabel(item.status)}
                        </Text>
                      </View>
                      <Text style={styles.cardData}>{formatDate(new Date(item.created_at))}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardPontos}>🏆 {item.pontos_debitados} pts</Text>

                  {isPending ? (
                    <View style={styles.acoesRow}>
                      <Pressable
                        style={({ pressed }) => [styles.botaoConfirmar, isProcessing && styles.botaoDesabilitado, pressed && !isProcessing && { opacity: 0.85 }]}
                        onPress={() => handleConfirm(item.id, item.filhos.nome, item.premios.nome)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.botaoConfirmarTexto}>{isProcessing ? '…' : '✓ Confirmar'}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.botaoCancelar, isProcessing && styles.botaoDesabilitado, pressed && !isProcessing && { opacity: 0.85 }]}
                        onPress={() => handleCancel(item.id, item.filhos.nome, item.premios.nome, item.pontos_debitados)}
                        disabled={isProcessing}
                      >
                        <Text style={styles.botaoCancelarTexto}>{isProcessing ? '…' : '✕ Cancelar'}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], gap: spacing['2'], paddingBottom: spacing['10'] },
    erroAcao: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium, marginBottom: spacing['2'], textAlign: 'center' },
    secaoHeader: { paddingVertical: spacing['2'] },
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
    cardFilho: { fontSize: typography.size.xs, color: colors.text.secondary },
    alertaIcone: { fontSize: 24, marginBottom: spacing['2'] },
    statusBadge: { borderRadius: radii.md, borderCurve: 'continuous', paddingHorizontal: spacing['2'], paddingVertical: spacing['1'], alignSelf: 'flex-end' },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    cardData: { fontSize: typography.size.xs, color: colors.text.muted, textAlign: 'right', marginTop: spacing['1'] },
    cardPontos: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.admin },
    dataSolicitacao: { fontSize: typography.size.xs, color: colors.text.muted },
    acoesRow: { flexDirection: 'row', gap: spacing['2'], marginTop: spacing['1'] },
    botaoConfirmar: { flex: 1, backgroundColor: colors.semantic.success, borderRadius: radii.lg, borderCurve: 'continuous', paddingVertical: spacing['2'], alignItems: 'center', minHeight: 44 },
    botaoConfirmarTexto: { color: '#fff', fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoCancelar: { flex: 1, borderRadius: radii.lg, borderCurve: 'continuous', borderWidth: 1.5, borderColor: colors.semantic.error, paddingVertical: spacing['2'], alignItems: 'center', minHeight: 44 },
    botaoCancelarTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.sm },
    botaoDesabilitado: { opacity: 0.5 },
  });
}
