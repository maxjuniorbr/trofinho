import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  listarAtribuicoesFilho,
  labelStatus,
  corStatus,
  type AtribuicaoFilho,
  type StatusAtribuicao,
} from '@lib/tarefas';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

type Filtro = 'pendente' | 'aguardando_validacao' | 'historico';

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'pendente', label: 'Pendentes' },
  { key: 'aguardando_validacao', label: 'Em validação' },
  { key: 'historico', label: 'Histórico' },
];

function pertenceFiltro(status: StatusAtribuicao, filtro: Filtro): boolean {
  if (filtro === 'historico') return status === 'aprovada' || status === 'rejeitada';
  return status === filtro;
}

export default function FilhoTarefasScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [atribuicoes, setAtribuicoes] = useState<AtribuicaoFilho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('pendente');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await listarAtribuicoesFilho();
      if (error) setErro(error);
      else setAtribuicoes(data);
    } catch {
      setErro('Não foi possível carregar suas tarefas agora.');
      setAtribuicoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const filtradas = atribuicoes.filter((a) => pertenceFiltro(a.status, filtro));
  let mensagemVazio = 'Nenhuma tarefa concluída ainda.';

  if (filtro === 'pendente') {
    mensagemVazio = 'Nenhuma tarefa pendente.';
  } else if (filtro === 'aguardando_validacao') {
    mensagemVazio = 'Nada aguardando validação.';
  }

  const shouldShowEmptyState = carregando || Boolean(erro) || filtradas.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Minhas Tarefas" onBack={() => router.back()} backLabel="← Início" />

      <View style={styles.filtrosRow}>
        {FILTROS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.filtroBtn, filtro === f.key && styles.filtroBtnAtivo]}
            onPress={() => setFiltro(f.key)}
          >
            <Text style={[styles.filtroTexto, filtro === f.key && styles.filtroTextoAtivo]}>
              {f.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {shouldShowEmptyState ? (
        <EmptyState
          loading={carregando}
          error={erro}
          empty={!carregando && !erro}
          emptyMessage={mensagemVazio}
          onRetry={carregar}
        />
      ) : (
        <FlatList
          data={filtradas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push(`/(filho)/tarefas/${item.id}` as never)}
            >
              <View style={styles.cardTopo}>
                <Text style={styles.cardTitulo} numberOfLines={2}>{item.tarefas.titulo}</Text>
                <View style={styles.pontosTag}>
                  <Text style={styles.pontosTexto}>{item.tarefas.pontos} pts</Text>
                </View>
              </View>
              <Text style={styles.cardPrazo}>Prazo: {item.tarefas.timebox_fim}</Text>
              <View style={[styles.statusTag, { backgroundColor: corStatus(item.status) + '20' }]}>
                <Text style={[styles.statusTexto, { color: corStatus(item.status) }]}>
                  {labelStatus(item.status)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    filtrosRow: {
      flexDirection: 'row',
      backgroundColor: colors.bg.surface,
      paddingHorizontal: spacing['4'],
      paddingBottom: spacing['3'],
      gap: spacing['2'],
      borderBottomWidth: 1,
      borderBottomColor: colors.border.default,
    },
    filtroBtn: {
      flex: 1,
      paddingVertical: spacing['2'],
      borderRadius: radii.md,
      alignItems: 'center',
      backgroundColor: colors.accent.filhoBg,
    },
    filtroBtnAtivo: { backgroundColor: colors.accent.filho },
    filtroTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary },
    filtroTextoAtivo: { color: '#fff' },
    lista: { padding: spacing['4'], gap: spacing['3'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      ...shadows.card,
    },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['2'] },
    cardTitulo: { flex: 1, fontSize: typography.size.md, fontFamily: typography.family.semibold, color: colors.text.primary, marginRight: spacing['2'] },
    pontosTag: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.sm, paddingVertical: 3, paddingHorizontal: spacing['2'] },
    pontosTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.accent.filho },
    cardPrazo: { fontSize: typography.size.xs, color: colors.text.muted, marginBottom: spacing['2'] },
    statusTag: { borderRadius: radii.sm, paddingVertical: 3, paddingHorizontal: spacing['2'], alignSelf: 'flex-start' },
    statusTexto: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
  });
}
