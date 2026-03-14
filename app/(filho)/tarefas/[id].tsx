import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  buscarAtribuicaoFilho,
  concluirAtribuicao,
  labelStatus,
  corStatus,
  type AtribuicaoFilho,
} from '@lib/tarefas';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function FilhoTarefaDetalheScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [atribuicao, setAtribuicao] = useState<AtribuicaoFilho | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [concluindo, setConcluindo] = useState(false);
  const [erroConclusao, setErroConclusao] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setCarregando(true);
    setErro(null);
    try {
      const { data, error } = await buscarAtribuicaoFilho(id);
      if (error) setErro(error);
      else setAtribuicao(data);
    } catch {
      setErro('Não foi possível carregar a tarefa agora.');
      setAtribuicao(null);
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleConcluir() {
    if (!atribuicao) return;
    setErroConclusao(null);

    if (atribuicao.tarefas.exige_evidencia) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setErroConclusao('Permissão da câmera negada. Habilite nas configurações do dispositivo.');
        return;
      }
      const resultado = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: true,
        aspect: [4, 3],
      });
      if (resultado.canceled || resultado.assets.length === 0) return;
      const imagemUri = resultado.assets[0].uri;
      setConcluindo(true);
      const { error } = await concluirAtribuicao(atribuicao.id, imagemUri);
      setConcluindo(false);
      if (error) setErroConclusao(error);
      else await carregar();
    } else {
      setConcluindo(true);
      const { error } = await concluirAtribuicao(atribuicao.id, null);
      setConcluindo(false);
      if (error) setErroConclusao(error);
      else await carregar();
    }
  }

  if (carregando) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  if (erro || !atribuicao) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Detalhe" onBack={() => router.back()} backLabel="← Tarefas" />
        <EmptyState error={erro ?? 'Tarefa não encontrada.'} onRetry={carregar} />
      </View>
    );
  }

  const tarefa = atribuicao.tarefas;
  const podeConcluir = atribuicao.status === 'pendente';

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Detalhe" onBack={() => router.back()} backLabel="← Tarefas" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: corStatus(atribuicao.status) }]}>
          <Text style={styles.statusBadgeTexto}>{labelStatus(atribuicao.status)}</Text>
        </View>

        {/* Dados da tarefa */}
        <View style={styles.card}>
          <View style={styles.cardTopo}>
            <Text style={styles.cardTitulo}>{tarefa.titulo}</Text>
            <View style={styles.pontosTag}>
              <Text style={styles.pontosTexto}>{tarefa.pontos} pts</Text>
            </View>
          </View>
          {tarefa.descricao ? <Text style={styles.descricao}>{tarefa.descricao}</Text> : null}
          <Text style={styles.meta}>
            {tarefa.timebox_inicio}
            {' \u2192 '}
            {tarefa.timebox_fim}
          </Text>
          {tarefa.exige_evidencia && (
            <View style={styles.tagEvidencia}>
              <Text style={styles.tagEvidenciaTexto}>📷 Enviar foto como prova</Text>
            </View>
          )}
        </View>

        {/* Evidência enviada */}
        {atribuicao.evidencia_url ? (
          <View style={styles.evidenciaBox}>
            <Text style={styles.evidenciaLabel}>Foto enviada:</Text>
            <Image source={{ uri: atribuicao.evidencia_url }} style={styles.evidenciaImg} resizeMode="cover" />
          </View>
        ) : null}

        {/* Nota de rejeição */}
        {atribuicao.nota_rejeicao ? (
          <View style={styles.notaRejeicaoBox}>
            <Text style={styles.notaRejeicaoLabel}>Motivo da rejeição:</Text>
            <Text style={styles.notaRejeicaoTexto}>{atribuicao.nota_rejeicao}</Text>
            <Text style={styles.notaRejeicaoHint}>Converse com o responsável para alinhar os próximos passos.</Text>
          </View>
        ) : null}

        {/* Ação de conclusão */}
        {podeConcluir && (
          <>
            {erroConclusao ? <Text style={styles.erroTexto}>{erroConclusao}</Text> : null}
            <Pressable
              style={[styles.botaoConcluir, concluindo && styles.botaoDesabilitado]}
              onPress={handleConcluir}
              disabled={concluindo}
            >
              {concluindo
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.botaoConcluirTexto}>
                    {tarefa.exige_evidencia ? '📷 Tirar foto e concluir' : '✓ Concluir tarefa'}
                  </Text>
              }
            </Pressable>
          </>
        )}

        {atribuicao.status === 'aguardando_validacao' && (
          <View style={styles.aguardandoBox}>
            <Text style={styles.aguardandoTexto}>⏳ Aguardando validação do responsável</Text>
          </View>
        )}

        {atribuicao.status === 'aprovada' && (
          <View style={styles.aprovadoBox}>
            <Text style={styles.aprovadoTexto}>🏆 Parabéns! {tarefa.pontos} pontos creditados no seu saldo.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    container: { flex: 1 },
    scrollContent: { padding: spacing['4'], paddingBottom: spacing['12'] },
    statusBadge: {
      borderRadius: radii.lg,
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      alignSelf: 'center',
      marginBottom: spacing['4'],
    },
    statusBadgeTexto: { color: '#fff', fontSize: typography.size.sm, fontFamily: typography.family.bold },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      padding: spacing['4'],
      marginBottom: spacing['4'],
      ...shadows.card,
    },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing['2'] },
    cardTitulo: { flex: 1, fontSize: typography.size.lg, fontFamily: typography.family.bold, color: colors.text.primary, marginRight: spacing['2'] },
    pontosTag: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.md, paddingVertical: spacing['1'], paddingHorizontal: spacing['2'] },
    pontosTexto: { fontSize: typography.size.sm, fontFamily: typography.family.bold, color: colors.accent.filho },
    descricao: { fontSize: typography.size.sm, color: colors.text.secondary, marginBottom: spacing['2'], lineHeight: 20 },
    meta: { fontSize: typography.size.xs, color: colors.text.muted },
    tagEvidencia: {
      backgroundColor: colors.semantic.warningBg,
      borderRadius: radii.sm,
      paddingVertical: 3,
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
      marginTop: spacing['2'],
    },
    tagEvidenciaTexto: { fontSize: typography.size.xs, color: colors.semantic.warning, fontFamily: typography.family.semibold },
    evidenciaBox: { marginBottom: spacing['4'] },
    evidenciaLabel: { fontSize: typography.size.xs, fontFamily: typography.family.semibold, color: colors.text.secondary, marginBottom: spacing['2'] },
    evidenciaImg: { width: '100%', height: 220, borderRadius: radii.xl },
    notaRejeicaoBox: { backgroundColor: colors.semantic.errorBg, borderRadius: radii.xl, padding: spacing['3'], marginBottom: spacing['4'] },
    notaRejeicaoLabel: { fontSize: typography.size.xs, fontFamily: typography.family.bold, color: colors.semantic.error, marginBottom: spacing['1'] },
    notaRejeicaoTexto: { fontSize: typography.size.sm, color: colors.text.primary, marginBottom: spacing['2'] },
    notaRejeicaoHint: { fontSize: typography.size.xs, color: colors.text.muted, fontStyle: 'italic' },
    erroTexto: { color: colors.semantic.error, fontSize: typography.size.sm, textAlign: 'center', marginBottom: spacing['3'], marginTop: spacing['2'] },
    botaoConcluir: { backgroundColor: colors.accent.filho, borderRadius: radii.xl, paddingVertical: spacing['4'], alignItems: 'center', marginTop: spacing['2'] },
    botaoDesabilitado: { opacity: 0.6 },
    botaoConcluirTexto: { color: '#fff', fontSize: typography.size.md, fontFamily: typography.family.bold },
    aguardandoBox: { backgroundColor: colors.accent.filhoBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    aguardandoTexto: { fontSize: typography.size.sm, color: colors.accent.filho, fontFamily: typography.family.semibold },
    aprovadoBox: { backgroundColor: colors.semantic.successBg, borderRadius: radii.xl, padding: spacing['3'], alignItems: 'center', marginTop: spacing['2'] },
    aprovadoTexto: { fontSize: typography.size.sm, color: colors.semantic.success, fontFamily: typography.family.semibold, textAlign: 'center' },
  });
}
