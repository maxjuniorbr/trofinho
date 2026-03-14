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
  listarResgates,
  confirmarResgate,
  cancelarResgate,
  labelStatusResgate,
  emojiStatusResgate,
  corStatusResgate,
  type ResgateComFilhoEPremio,
} from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { formatarData } from '@lib/utils';

export default function AdminResgatesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [resgates, setResgates] = useState<ResgateComFilhoEPremio[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const hasErro = Boolean(erro);
  const hasErroAcao = Boolean(erroAcao);
  const shouldShowEmptyState = carregando || hasErro || resgates.length === 0;

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setErroAcao(null);
    try {
      const { data, error } = await listarResgates();
      if (error) setErro(error);
      else setResgates(data);
    } catch {
      setErro('Não foi possível carregar os resgates agora.');
      setResgates([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleConfirmar(resgateId: string, nomeFilho: string, nomePremio: string) {
    setErroAcao(null);
    Alert.alert(
      'Confirmar entrega',
      `Confirmar entrega do prêmio "${nomePremio}" para ${nomeFilho}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: 'default',
          onPress: async () => {
            setProcessando(resgateId);
            const { error } = await confirmarResgate(resgateId);
            setProcessando(null);
            if (error) setErroAcao(error);
            else carregar();
          },
        },
      ]
    );
  }

  async function handleCancelar(resgateId: string, nomeFilho: string, nomePremio: string, pontos: number) {
    setErroAcao(null);
    Alert.alert(
      'Cancelar resgate',
      `Cancelar o resgate de "${nomePremio}" de ${nomeFilho}? Os ${pontos} pts serão estornados.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Cancelar resgate',
          style: 'destructive',
          onPress: async () => {
            setProcessando(resgateId);
            const { error } = await cancelarResgate(resgateId);
            setProcessando(null);
            if (error) setErroAcao(error);
            else carregar();
          },
        },
      ]
    );
  }

  const pendentes = resgates.filter((r) => r.status === 'pendente');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Resgates" onBack={() => router.back()} backLabel="Início" />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={carregando}
          error={erro}
          empty={!carregando && !erro}
          emptyMessage="Nenhum resgate registrado ainda."
          onRetry={carregar}
        />
      ) : (
        <FlatList
          data={resgates}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <>
              {hasErroAcao ? <Text style={styles.erroAcao}>{erroAcao}</Text> : null}
              {pendentes.length > 0 && (
                <View style={styles.secaoHeader}>
                  <Text style={styles.secaoTitulo}>⏳ Pendentes ({pendentes.length})</Text>
                </View>
              )}
            </>
          }
          renderItem={({ item, index }) => {
            const isPendente = item.status === 'pendente';
            const isProcessando = processando === item.id;
            const anteriorPendente = index > 0 && resgates[index - 1]?.status === 'pendente';
            const mostrarSeparadorHistorico = !isPendente && (index === 0 || anteriorPendente);

            return (
              <>
                {mostrarSeparadorHistorico ? (
                  <View style={styles.secaoHeader}>
                    <Text style={styles.secaoTitulo}>Histórico</Text>
                  </View>
                ) : null}
                <View style={[styles.card, isPendente && styles.cardPendente]}>
                  <View style={styles.cardTopo}>
                    <View style={{ flex: 1, gap: spacing['1'] }}>
                    <Text style={[styles.premioNome, { color: colors.text.primary }]}>{item.premios.nome}</Text>
                      <Text style={styles.cardFilho}>👤 {item.filhos.nome}</Text>
                    </View>
                    <View>
                      <View style={[styles.statusBadge, { backgroundColor: corStatusResgate(item.status) + '22' }]}>
                        <Text style={[styles.statusTexto, { color: corStatusResgate(item.status) }]}>
                          {emojiStatusResgate(item.status)} {labelStatusResgate(item.status)}
                        </Text>
                      </View>
                      <Text style={styles.cardData}>{formatarData(new Date(item.created_at))}</Text>
                    </View>
                  </View>

                  <Text style={styles.cardPontos}>🏆 {item.pontos_debitados} pts</Text>

                  {isPendente ? (
                    <View style={styles.acoesRow}>
                      <Pressable
                        style={({ pressed }) => [styles.botaoConfirmar, isProcessando && styles.botaoDesabilitado, pressed && !isProcessando && { opacity: 0.85 }]}
                        onPress={() => handleConfirmar(item.id, item.filhos.nome, item.premios.nome)}
                        disabled={isProcessando}
                      >
                        <Text style={styles.botaoConfirmarTexto}>{isProcessando ? '…' : '✓ Confirmar'}</Text>
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.botaoCancelar, isProcessando && styles.botaoDesabilitado, pressed && !isProcessando && { opacity: 0.85 }]}
                        onPress={() => handleCancelar(item.id, item.filhos.nome, item.premios.nome, item.pontos_debitados)}
                        disabled={isProcessando}
                      >
                        <Text style={styles.botaoCancelarTexto}>{isProcessando ? '…' : '✕ Cancelar'}</Text>
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
