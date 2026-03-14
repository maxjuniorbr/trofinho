import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarAtribuicoesFilho } from '@lib/tarefas';
import { buscarSaldo } from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Familia = { nome: string };
const TASKS_LINK_LABEL = 'Ver tarefas →';
const SALDO_LINK_LABEL = 'Ver detalhes →';
const PREMIOS_LINK_LABEL = 'Ver prêmios →';
const RESGATES_LINK_LABEL = 'Ver resgates →';

export default function FilhoHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const [saldoLivre, setSaldoLivre] = useState(0);
  const [cofrinho, setCofrinho] = useState(0);
  const hasPendentes = pendentes > 0;
  const hasSaldoLivre = saldoLivre > 0;

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const p = await buscarPerfil();
      setProfile(p);
      if (p?.familia_id) {
        const { data: fam } = await supabase.from('familias').select('nome').eq('id', p.familia_id).single();
        setFamilia(fam);
      } else {
        setFamilia(null);
      }
      const { data: atribuicoes } = await listarAtribuicoesFilho();
      setPendentes(atribuicoes.filter((a) => a.status === 'pendente').length);
      const { data: s } = await buscarSaldo();
      setSaldoLivre(s?.saldo_livre ?? 0);
      setCofrinho(s?.cofrinho ?? 0);
    } catch {
      setFamilia(null);
      setPendentes(0);
      setSaldoLivre(0);
      setCofrinho(0);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const tarefaPendenteLabel = pendentes === 1 ? 'tarefa pendente' : 'tarefas pendentes';
  const tarefasPendentesTexto = hasPendentes
    ? `${pendentes} ${tarefaPendenteLabel} esperando por você!`
    : 'Nenhuma tarefa pendente no momento.';
  const saldoTexto = `💰 ${saldoLivre} pts livre · 🐷 ${cofrinho} pts cofrinho`;
  const premiosTexto = hasSaldoLivre
    ? `Você tem ${saldoLivre} pts disponíveis para resgatar!`
    : 'Veja os prêmios disponíveis e acumule pontos.';

  async function handleSair() {
    setSaindo(true);
    await signOut();
  }

  if (carregando) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing['6'] }]} style={{ backgroundColor: colors.bg.canvas }}>
      <StatusBar style={colors.statusBar} />

      <View style={styles.header}>
        <Text style={styles.emoji}>⭐</Text>
        <Text style={styles.familia}>{familia?.nome ?? '—'}</Text>
        <Text style={styles.boasVindas}>Olá, {profile?.nome ?? 'Filho'}!</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(filho)/tarefas')}
        accessibilityRole="button"
        accessibilityLabel={`Minhas Tarefas. ${tarefasPendentesTexto}`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>📋 Minhas Tarefas</Text>
          {hasPendentes ? (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{pendentes}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.cardTexto}>{tarefasPendentesTexto}</Text>
        <Text style={styles.cardLink}>{TASKS_LINK_LABEL}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(filho)/saldo')}
        accessibilityRole="button"
        accessibilityLabel={`Meu Saldo. ${saldoLivre} pontos livre, ${cofrinho} pontos cofrinho`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>💰 Meu Saldo</Text>
        </View>
        <Text style={styles.cardTexto}>{saldoTexto}</Text>
        <Text style={styles.cardLink}>{SALDO_LINK_LABEL}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(filho)/premios' as never)}
        accessibilityRole="button"
        accessibilityLabel="Catálogo de Prêmios"
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>🎁 Catálogo de Prêmios</Text>
        </View>
        <Text style={styles.cardTexto}>{premiosTexto}</Text>
        <Text style={styles.cardLink}>{PREMIOS_LINK_LABEL}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(filho)/resgates' as never)}
        accessibilityRole="button"
        accessibilityLabel="Meus Resgates"
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>🛍️ Meus Resgates</Text>
        </View>
        <Text style={styles.cardTexto}>Acompanhe o status dos seus resgates.</Text>
        <Text style={styles.cardLink}>{RESGATES_LINK_LABEL}</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.botaoSair, saindo && styles.botaoDesabilitado, pressed && !saindo && { opacity: 0.7 }]}
        onPress={handleSair}
        disabled={saindo}
        accessibilityRole="button"
        accessibilityLabel={saindo ? 'Saindo' : 'Sair'}
      >
        <Text style={styles.botaoSairTexto}>{saindo ? 'Saindo…' : 'Sair'}</Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['6'],
    },
    header: { alignItems: 'center', marginBottom: spacing['8'] },
    emoji: { fontSize: 48 },
    familia: { fontSize: typography.size['2xl'], fontWeight: typography.weight.bold, color: colors.accent.filho, marginTop: spacing['3'] },
    boasVindas: { fontSize: typography.size.md, color: colors.text.secondary, marginTop: spacing['1'] },
    card: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['6'],
      width: '100%',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      marginBottom: spacing['4'],
    },
    cardTopo: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing['2'] },
    cardTitulo: { fontSize: typography.size.sm, fontWeight: typography.weight.bold, color: colors.accent.filho, flex: 1 },
    badge: {
      backgroundColor: colors.semantic.error,
      borderRadius: radii.full,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['2'],
      paddingVertical: 2,
      minWidth: 24,
      alignItems: 'center',
    },
    badgeTexto: { color: '#fff', fontSize: typography.size.xs, fontWeight: typography.weight.bold },
    cardTexto: { fontSize: typography.size.md, color: colors.text.primary, lineHeight: 22 },
    cardLink: { fontSize: typography.size.sm, color: colors.accent.filho, fontWeight: typography.weight.semibold, marginTop: spacing['2'] },
    botaoSair: {
      borderWidth: 1,
      borderColor: colors.border.default,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['8'],
      minHeight: 44,
    },
    botaoDesabilitado: { opacity: 0.5 },
    botaoSairTexto: { color: colors.text.secondary, fontSize: typography.size.md, fontWeight: typography.weight.medium },
  });
}
