import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarTarefasAdmin } from '@lib/tarefas';
import { listarFilhos } from '@lib/filhos';
import { listarSaldosAdmin } from '@lib/saldos';
import { contarResgatesPendentes } from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

type Familia = { nome: string };

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [qtdValidar, setQtdValidar] = useState(0);
  const [qtdFilhos, setQtdFilhos] = useState(0);
  const [totalPontos, setTotalPontos] = useState(0);
  const [qtdResgatesPendentes, setQtdResgatesPendentes] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const p = await buscarPerfil();
      setProfile(p);
      if (p?.familia_id) {
        const { data: fam } = await supabase.from('familias').select('nome').eq('id', p.familia_id).single();
        setFamilia(fam);
      } else { setFamilia(null); }
      const { data: tarefas } = await listarTarefasAdmin();
      setQtdValidar(tarefas.reduce((acc, t) => acc + t.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length, 0));
      const { data: filhos } = await listarFilhos();
      setQtdFilhos(filhos.length);
      const { data: saldos } = await listarSaldosAdmin();
      setTotalPontos(saldos.reduce((acc, s) => acc + s.saldo_livre + s.cofrinho, 0));
      const { data: qtdPendentes } = await contarResgatesPendentes();
      setQtdResgatesPendentes(qtdPendentes);
    } catch {
      setFamilia(null); setQtdValidar(0); setQtdFilhos(0); setTotalPontos(0); setQtdResgatesPendentes(0);
    } finally { setCarregando(false); }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const tarefasPendentesTexto = qtdValidar === 0 ? 'Crie tarefas e acompanhe o progresso dos filhos.' : `${qtdValidar} ${qtdValidar === 1 ? 'tarefa' : 'tarefas'} aguardando validação.`;
  const filhosTexto = qtdFilhos === 0 ? 'Cadastre os filhos da família.' : qtdFilhos === 1 ? '1 filho cadastrado.' : `${qtdFilhos} filhos cadastrados.`;
  const resgatesTexto = qtdResgatesPendentes === 0 ? 'Confirme os resgates solicitados pelos filhos.' : `${qtdResgatesPendentes} ${qtdResgatesPendentes === 1 ? 'resgate' : 'resgates'} aguardando confirmação.`;
  const resgatesAccessLabel = qtdResgatesPendentes === 0 ? 'Resgates. Nenhum pendente' : `Resgates. ${qtdResgatesPendentes} ${qtdResgatesPendentes === 1 ? 'pendente' : 'pendentes'}`;

  async function handleSair() { setSaindo(true); await signOut(); }

  if (carregando) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas, paddingTop: insets.top }]} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing['5'] }]}
      style={{ backgroundColor: colors.bg.canvas }}
    >
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <Text style={styles.emoji}>👑</Text>
        <Text style={[styles.familia, { color: colors.accent.admin }]}>{familia?.nome ?? '—'}</Text>
        <Text style={[styles.boasVindas, { color: colors.text.secondary }]}>Olá, {profile?.nome ?? 'Admin'}!</Text>
      </View>

      {([
        { emoji: '📋', titulo: 'Tarefas', texto: tarefasPendentesTexto, link: 'Ver tarefas →', rota: '/(admin)/tarefas', badge: qtdValidar, badgeCor: colors.semantic.error, accessLabel: `Tarefas. ${tarefasPendentesTexto}` },
        { emoji: '👨‍👧', titulo: 'Filhos', texto: filhosTexto, link: 'Gerenciar filhos →', rota: '/(admin)/filhos', badge: qtdFilhos, badgeCor: colors.semantic.success, accessLabel: `Filhos. ${filhosTexto}` },
        { emoji: '💰', titulo: 'Pontos & Cofrinho', texto: totalPontos > 0 ? `${totalPontos} pontos distribuídos na família.` : 'Gerencie valorização e penalizações dos filhos.', link: 'Ver saldos →', rota: '/(admin)/saldos', badge: 0, badgeCor: colors.semantic.info, accessLabel: 'Pontos e Cofrinho' },
        { emoji: '🎁', titulo: 'Prêmios', texto: 'Gerencie o catálogo de prêmios da família.', link: 'Ver prêmios →', rota: '/(admin)/premios', badge: 0, badgeCor: colors.brand.vivid, accessLabel: 'Prêmios' },
        { emoji: '🛍️', titulo: 'Resgates', texto: resgatesTexto, link: 'Ver resgates →', rota: '/(admin)/resgates', badge: qtdResgatesPendentes, badgeCor: colors.semantic.warning, accessLabel: resgatesAccessLabel },
      ] as const).map(({ emoji, titulo, texto, link, rota, badge, badgeCor, accessLabel }) => (
        <Pressable
          key={rota}
          style={({ pressed }) => [styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, boxShadow: colors.shadow.low, opacity: pressed ? 0.88 : 1 }]}
          onPress={() => router.push(rota as never)}
          accessibilityRole="button"
          accessibilityLabel={accessLabel}
        >
          <View style={styles.cardTopo}>
            <Text style={[styles.cardTitulo, { color: colors.accent.admin }]}>{emoji} {titulo}</Text>
            {badge > 0 && (
              <View style={[styles.badge, { backgroundColor: badgeCor }]}>
                <Text style={styles.badgeTexto}>{badge}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.cardTexto, { color: colors.text.secondary }]}>{texto}</Text>
          <Text style={[styles.cardLink, { color: colors.accent.admin }]}>{link}</Text>
        </Pressable>
      ))}

      <Pressable
        style={({ pressed }) => [styles.botaoSair, { borderColor: colors.border.default, opacity: (saindo || pressed) ? 0.6 : 1 }]}
        onPress={handleSair}
        disabled={saindo}
        accessibilityRole="button"
      >
        <Text style={[styles.botaoSairTexto, { color: colors.text.secondary }]}>{saindo ? 'Saindo…' : 'Sair'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { flexGrow: 1, alignItems: 'center', padding: spacing['5'], paddingBottom: spacing['12'] },
    header: { alignItems: 'center', marginBottom: spacing['6'] },
    emoji: { fontSize: 48 },
    familia: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, marginTop: spacing['3'] },
    boasVindas: { fontSize: typography.size.md, marginTop: spacing['1'] },
    card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['6'], width: '100%', marginBottom: spacing['3'] },
    cardTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['2'] },
    cardTitulo: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, flex: 1 },
    badge: { borderRadius: radii.full, paddingHorizontal: spacing['2'], paddingVertical: 2, minWidth: 24, alignItems: 'center' },
    badgeTexto: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.bold },
    cardTexto: { fontSize: typography.size.sm, lineHeight: 20, marginBottom: spacing['2'] },
    cardLink: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
    botaoSair: { borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['6'], marginTop: spacing['4'] },
    botaoSairTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.medium },
  });
}
