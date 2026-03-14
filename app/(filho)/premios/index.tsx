import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  listarPremiosAtivos,
  solicitarResgate,
  type Premio,
} from '@lib/premios';
import { buscarSaldo } from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';

export default function FilhoPremiosScreen() {
  const router = useRouter();
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
      <ScreenHeader title="Meus Prêmios" onBack={() => router.back()} backLabel="Início" role="filho" />

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
          numColumns={2}
          columnWrapperStyle={{ gap: spacing['3'] }}
          ListHeaderComponent={
            <>
              <LinearGradient
                colors={gradients.goldHorizontal.colors}
                start={gradients.goldHorizontal.start}
                end={gradients.goldHorizontal.end}
                style={styles.saldoBanner}
              >
                <Text style={styles.saldoLabel}>Saldo disponível</Text>
                <Text style={styles.saldoValor}>{saldoLivre}</Text>
                <Text style={styles.saldoPts}>pontos</Text>
              </LinearGradient>
              {hasErroResgate ? <Text style={styles.erroTexto}>{erroResgate}</Text> : null}
              {hasSucesso ? <Text style={styles.sucessoTexto}>{sucesso}</Text> : null}
            </>
          }
          renderItem={({ item }) => (
            <PremioCard
              item={item}
              saldoLivre={saldoLivre}
              resgatando={resgatando}
              onResgatar={handleResgatar}
            />
          )}
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
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['5'],
      alignItems: 'center',
      marginBottom: spacing['1'],
      gap: spacing['1'],
    },
    saldoLabel: { fontSize: typography.size.xs, color: 'rgba(42,36,16,0.75)', fontFamily: typography.family.semibold },
    saldoValor: { fontSize: typography.size['3xl'], fontFamily: typography.family.black, color: colors.text.onBrand },
    saldoPts: { fontSize: typography.size.xs, color: 'rgba(42,36,16,0.75)', fontFamily: typography.family.medium },
    erroTexto: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium, marginBottom: spacing['1'] },
    sucessoTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginBottom: spacing['1'] },
  });
}

type PremioCardProps = {
  item: Premio;
  saldoLivre: number;
  resgatando: string | null;
  onResgatar: (item: Premio) => void;
};

function PremioCard({ item, saldoLivre, resgatando, onResgatar }: PremioCardProps) {
  const { colors } = useTheme();
  const temSaldo = saldoLivre >= item.custo_pontos;
  const progress = item.custo_pontos > 0 ? Math.min(saldoLivre / item.custo_pontos, 1) : 1;
  const isResgatando = resgatando === item.id;
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 700,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={[cardEstilos.card, shadows.card, { backgroundColor: colors.bg.surface }]}>
      <Text style={[cardEstilos.nome, { color: colors.text.primary }]} numberOfLines={2}>
        {item.nome}
      </Text>
      {item.descricao ? (
        <Text style={[cardEstilos.desc, { color: colors.text.secondary }]} numberOfLines={2}>
          {item.descricao}
        </Text>
      ) : null}
      <Text style={[cardEstilos.custo, { color: colors.accent.filho }]}>
        🏆 {item.custo_pontos} pts
      </Text>

      <View style={[cardEstilos.progressBg, { backgroundColor: colors.bg.muted }]}>
        <Animated.View
          style={[
            cardEstilos.progressFill,
            {
              backgroundColor: temSaldo ? colors.semantic.success : colors.accent.filho,
              width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            },
          ]}
        />
      </View>

      <View style={[cardEstilos.statusRow, { backgroundColor: temSaldo ? colors.semantic.successBg : colors.bg.muted }]}>
        <Text style={[cardEstilos.statusTexto, { color: temSaldo ? colors.semantic.success : colors.text.muted }]}>
          {temSaldo ? '✓ Disponível!' : `Faltam ${item.custo_pontos - saldoLivre} pts`}
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [
          cardEstilos.botao,
          { backgroundColor: temSaldo ? colors.accent.filho : colors.accent.filhoBg },
          (!temSaldo || resgatando !== null) && cardEstilos.botaoDesabilitado,
          pressed && temSaldo && !resgatando && { opacity: 0.85 },
        ]}
        onPress={() => onResgatar(item)}
        disabled={!temSaldo || resgatando !== null}
        accessibilityRole="button"
        accessibilityLabel={!temSaldo ? `Saldo insuficiente para ${item.nome}` : `Resgatar ${item.nome}`}
        accessibilityState={{ disabled: !temSaldo || resgatando !== null }}
      >
        {isResgatando ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={cardEstilos.botaoTexto}>{temSaldo ? 'Resgatar' : 'Sem saldo'}</Text>
        )}
      </Pressable>
    </View>
  );
}

const cardEstilos = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    padding: spacing['3'],
    gap: spacing['2'],
  },
  nome: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.bold,
  },
  desc: {
    fontSize: typography.size.xs,
  },
  custo: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.bold,
  },
  progressBg: {
    height: 4,
    borderRadius: radii.full,
    overflow: 'hidden',
    marginTop: spacing['1'],
  },
  progressFill: {
    height: '100%',
    borderRadius: radii.full,
  },
  statusRow: {
    borderRadius: radii.sm,
    paddingVertical: 3,
    paddingHorizontal: spacing['2'],
    alignSelf: 'flex-start',
  },
  statusTexto: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.semibold,
  },
  botao: {
    borderRadius: radii.lg,
    borderCurve: 'continuous',
    paddingVertical: spacing['2'],
    alignItems: 'center',
    marginTop: spacing['1'],
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoTexto: {
    color: '#fff',
    fontFamily: typography.family.bold,
    fontSize: typography.size.xs,
  },
});
