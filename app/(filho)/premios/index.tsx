import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  listarPremiosAtivos,
  solicitarResgate,
  type Premio,
} from '@lib/premios';
import { buscarSaldo } from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';

export default function FilhoPremiosScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [premios, setPremios] = useState<Premio[]>([]);
  const [saldoLivre, setSaldoLivre] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [erroResgate, setErroResgate] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const hasErroResgate = Boolean(erroResgate);
  const hasSucesso = Boolean(sucesso);
  const hasErro = Boolean(erro);
  const shouldShowEmptyState = carregando || hasErro || premios.length === 0;
  const emptyStateMessage = 'Nenhum prêmio disponível no momento.\nPergunte ao responsável!';

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setErroResgate(null);
    setSucesso(null);
    try {
      const [{ data: listaPremios, error: erroPremios }, { data: saldo, error: erroSaldo }] =
        await Promise.all([listarPremiosAtivos(), buscarSaldo()]);
      if (erroPremios) { setErro(erroPremios); } else { setPremios(listaPremios); }
      setSaldoLivre(saldo?.saldo_livre ?? 0);
      if (erroSaldo && !erroPremios) setErro(erroSaldo);
    } catch {
      setErro('Não foi possível carregar os prêmios agora.');
      setPremios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleResgatar(premio: Premio) {
    setErroResgate(null);
    setSucesso(null);
    setResgatando(premio.id);
    const { error } = await solicitarResgate(premio.id);
    setResgatando(null);
    if (error) {
      setErroResgate(error);
    } else {
      setSucesso(`Resgate de "${premio.nome}" solicitado! Aguarde a confirmação.`);
      setSaldoLivre((prev) => prev - premio.custo_pontos);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />

      {shouldShowEmptyState ? (
        <EmptyState
          loading={carregando}
          error={erro}
          empty={!carregando && !erro}
          emptyMessage={emptyStateMessage}
          onRetry={carregar}
        />
      ) : (
        <FlatList
          data={premios}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.lista}
          ListHeaderComponent={
            <>
              <View style={styles.saldoBanner}>
                <Text style={styles.saldoLabel}>Seu saldo disponível</Text>
                <Text style={styles.saldoValor}>💰 {saldoLivre} pts</Text>
              </View>
              {hasErroResgate ? <Text style={styles.erroTexto}>{erroResgate}</Text> : null}
              {hasSucesso ? <Text style={styles.sucessoTexto}>{sucesso}</Text> : null}
            </>
          }
          renderItem={({ item }) => {
            const temSaldo = saldoLivre >= item.custo_pontos;
            const isResgatando = resgatando === item.id;

            return (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{item.nome}</Text>
                  {item.descricao ? (
                    <Text style={styles.cardDescricao} numberOfLines={2}>{item.descricao}</Text>
                  ) : null}
                  <Text style={styles.cardCusto}>🏆 {item.custo_pontos} pts</Text>
                  {!temSaldo && (
                    <Text style={styles.textoSemSaldo}>Faltam {item.custo_pontos - saldoLivre} pts</Text>
                  )}
                </View>
                <Pressable
                  style={({ pressed }) => [
                    styles.botaoResgatar,
                    (!temSaldo || isResgatando || resgatando !== null) && styles.botaoDesabilitado,
                    pressed && temSaldo && !resgatando && { opacity: 0.85 },
                  ]}
                  onPress={() => handleResgatar(item)}
                  disabled={!temSaldo || resgatando !== null}
                  accessibilityRole="button"
                  accessibilityLabel={!temSaldo ? `Saldo insuficiente para ${item.nome}` : `Resgatar ${item.nome}`}
                  accessibilityState={{ disabled: !temSaldo || resgatando !== null }}
                >
                  {isResgatando
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.botaoResgatarTexto}>{temSaldo ? 'Resgatar' : 'Sem saldo'}</Text>}
                </Pressable>
              </View>
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
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['10'] },
    saldoBanner: {
      backgroundColor: colors.accent.filho,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      alignItems: 'center',
      marginBottom: spacing['1'],
      gap: spacing['1'],
    },
    saldoLabel: { fontSize: typography.size.xs, color: 'rgba(255,255,255,0.85)', fontWeight: typography.weight.medium },
    saldoValor: { fontSize: typography.size['2xl'], fontWeight: typography.weight.extrabold, color: '#fff' },
    erroTexto: { color: colors.semantic.error, fontSize: typography.size.sm, fontWeight: typography.weight.medium, marginBottom: spacing['1'] },
    sucessoTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontWeight: typography.weight.semibold, marginBottom: spacing['1'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    },
    cardInfo: { flex: 1, gap: spacing['1'] },
    cardNome: { fontSize: typography.size.md, fontWeight: typography.weight.semibold, color: colors.text.primary },
    cardDescricao: { fontSize: typography.size.xs, color: colors.text.secondary },
    cardCusto: { fontSize: typography.size.xs, fontWeight: typography.weight.bold, color: colors.accent.filho },
    textoSemSaldo: { fontSize: typography.size.xs, color: colors.semantic.error },
    botaoResgatar: {
      backgroundColor: colors.accent.filho,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['2'],
      alignItems: 'center',
      minWidth: 88,
    },
    botaoDesabilitado: { backgroundColor: colors.accent.filhoBg },
    botaoResgatarTexto: { color: '#fff', fontWeight: typography.weight.bold, fontSize: typography.size.sm },
  });
}
