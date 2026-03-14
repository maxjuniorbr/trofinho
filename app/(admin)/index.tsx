import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarTarefasAdmin } from '@lib/tarefas';
import { listarSaldosAdmin, type SaldoComFilho } from '@lib/saldos';
import { contarResgatesPendentes } from '@lib/premios';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/avatar';
import { PointsDisplay } from '@/components/ui/points-display';
import { Badge } from '@/components/ui/badge';

type Familia = { nome: string };

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [saldos, setSaldos] = useState<SaldoComFilho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [qtdValidar, setQtdValidar] = useState(0);
  const [qtdResgatesPendentes, setQtdResgatesPendentes] = useState(0);

  // ─── Entrance animation ───────────────────────────────────
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY       = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!carregando) {
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
      ]).start();
    }
  }, [carregando, headerOpacity, headerY]);

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
      const { data: tarefas } = await listarTarefasAdmin();
      setQtdValidar(tarefas.reduce((acc, t) => acc + t.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length, 0));
      const { data: saldosData } = await listarSaldosAdmin();
      setSaldos(saldosData);
      const { data: qtdPendentes } = await contarResgatesPendentes();
      setQtdResgatesPendentes(qtdPendentes);
    } catch {
      setFamilia(null);
      setSaldos([]);
      setQtdValidar(0);
      setQtdResgatesPendentes(0);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleSair() { setSaindo(true); await signOut(); }

  if (carregando) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  const totalPontos = saldos.reduce((acc, s) => acc + s.saldo_livre + s.cofrinho, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg.canvas }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing['6'] }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={colors.statusBar} />

      {/* ── Hero Header ───────────────────────────────────── */}
      <Animated.View
        style={[styles.hero, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}
      >
        <View style={styles.heroText}>
          <Text style={[styles.heroSub, { color: colors.text.secondary }]}>Bom dia 👋</Text>
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            Olá, {profile?.nome ?? 'Admin'}
          </Text>
          {familia ? (
            <Text style={[styles.heroFamily, { color: colors.accent.admin }]}>{familia.nome}</Text>
          ) : null}
        </View>
        <Avatar name={profile?.nome ?? 'A'} size={52} />
      </Animated.View>

      {/* ── Stats strip ───────────────────────────────────── */}
      <Animated.View
        style={[styles.statsRow, { opacity: headerOpacity }]}
      >
        <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <Text style={[styles.statValue, { color: colors.brand.vivid }]}>{saldos.length}</Text>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>filhos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <PointsDisplay value={totalPontos} label="pts família" variant="gold" size="sm" />
        </View>
        {qtdValidar > 0 ? (
          <View style={[styles.statCard, { backgroundColor: colors.semantic.errorBg, borderColor: colors.semantic.error + '40' }]}>
            <Text style={[styles.statValue, { color: colors.semantic.error }]}>{qtdValidar}</Text>
            <Text style={[styles.statLabel, { color: colors.semantic.error }]}>pendentes</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* ── Seus filhos ───────────────────────────────────── */}
      {saldos.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Seus filhos</Text>
            <Pressable onPress={() => router.push('/(admin)/filhos')} accessibilityRole="button">
              <Text style={[styles.sectionLink, { color: colors.brand.vivid }]}>Ver todos</Text>
            </Pressable>
          </View>
          <FlatList
            data={saldos}
            keyExtractor={(item) => item.filho_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childrenList}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.childCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}
                onPress={() => router.push(`/(admin)/saldos/${item.filho_id}` as never)}
                accessibilityRole="button"
                accessibilityLabel={`${item.filhos.nome}, ${item.saldo_livre + item.cofrinho} pontos`}
              >
                <Avatar name={item.filhos.nome} size={48} />
                <Text style={[styles.childName, { color: colors.text.primary }]} numberOfLines={1}>
                  {item.filhos.nome}
                </Text>
                <Text style={[styles.childPoints, { color: colors.brand.vivid }]}>
                  {(item.saldo_livre + item.cofrinho).toLocaleString('pt-BR')} pts
                </Text>
              </Pressable>
            )}
          />
        </View>
      ) : null}

      {/* ── Pendentes para validar ────────────────────────── */}
      {qtdValidar > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Pendentes</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.semantic.error }]}>
                <Text style={styles.countBadgeText}>{qtdValidar}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/(admin)/tarefas')} accessibilityRole="button">
              <Text style={[styles.sectionLink, { color: colors.brand.vivid }]}>Ver todas</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.navCard, { backgroundColor: colors.bg.surface, borderColor: colors.semantic.error + '40' }, shadows.card]}
            onPress={() => router.push('/(admin)/tarefas')}
            accessibilityRole="button"
            accessibilityLabel={`${qtdValidar} tarefas aguardando validação`}
          >
            <Text style={styles.navCardEmoji}>📋</Text>
            <View style={styles.navCardBody}>
              <Text style={[styles.navCardTitle, { color: colors.text.primary }]}>Tarefas</Text>
              <Text style={[styles.navCardSub, { color: colors.text.secondary }]}>
                {qtdValidar} {qtdValidar === 1 ? 'tarefa aguardando' : 'tarefas aguardando'} validação
              </Text>
            </View>
            <Badge label="Validar" variant="error" />
          </Pressable>
        </View>
      ) : null}

      {/* ── Ações rápidas ─────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Ações rápidas</Text>
        <View style={styles.quickGrid}>
          {([
            { emoji: '📋', label: 'Tarefas',    rota: '/(admin)/tarefas',  badge: qtdValidar        },
            { emoji: '👨‍👧', label: 'Filhos',     rota: '/(admin)/filhos',   badge: 0                 },
            { emoji: '💰', label: 'Saldos',     rota: '/(admin)/saldos',   badge: 0                 },
            { emoji: '🎁', label: 'Prêmios',    rota: '/(admin)/premios',  badge: 0                 },
            { emoji: '🛍️', label: 'Resgates',   rota: '/(admin)/resgates', badge: qtdResgatesPendentes },
          ] as const).map(({ emoji, label, rota, badge }) => (
            <Pressable
              key={rota}
              style={({ pressed }) => [
                styles.quickCard,
                { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                shadows.card,
                pressed && { opacity: 0.8 },
              ]}
              onPress={() => router.push(rota as never)}
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Text style={styles.quickEmoji}>{emoji}</Text>
              <Text style={[styles.quickLabel, { color: colors.text.primary }]}>{label}</Text>
              {badge > 0 ? (
                <View style={[styles.quickBadge, { backgroundColor: colors.semantic.error }]}>
                  <Text style={styles.quickBadgeText}>{badge}</Text>
                </View>
              ) : null}
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── Sair ─────────────────────────────────────────── */}
      <Pressable
        style={({ pressed }) => [
          styles.sairBtn,
          { borderColor: colors.border.default, opacity: (saindo || pressed) ? 0.6 : 1 },
        ]}
        onPress={handleSair}
        disabled={saindo}
        accessibilityRole="button"
        accessibilityLabel={saindo ? 'Saindo' : 'Sair'}
      >
        <Text style={[styles.sairTexto, { color: colors.text.secondary }]}>
          {saindo ? 'Saindo…' : 'Sair'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    loading:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:     { flexGrow: 1, paddingHorizontal: spacing.screen, paddingBottom: spacing['12'] },

    // Hero
    hero:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] },
    heroText:      { flex: 1, paddingRight: spacing['4'] },
    heroSub:       { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle:     { fontFamily: typography.family.black, fontSize: typography.size['2xl'], marginTop: 2 },
    heroFamily:    { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginTop: 2 },

    // Stats
    statsRow:      { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['6'] },
    statCard:      {
      flex: 1, borderRadius: radii.inner, borderWidth: 1,
      padding: spacing['3'], alignItems: 'center',
    },
    statValue:     { fontFamily: typography.family.black, fontSize: typography.size.xl },
    statLabel:     { fontFamily: typography.family.semibold, fontSize: typography.size.xs, marginTop: 2 },

    // Sections
    section:       { marginBottom: spacing['6'] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    sectionTitle:  { fontFamily: typography.family.bold, fontSize: typography.size.md },
    sectionLink:   { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    countBadge:    { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    countBadgeText:{ color: '#fff', fontFamily: typography.family.black, fontSize: typography.size.xs },

    // Children scroll
    childrenList:  { gap: spacing['3'] },
    childCard:     {
      width: 120, borderRadius: radii.inner, borderWidth: 1,
      padding: spacing['3'], alignItems: 'center', gap: spacing['2'],
    },
    childName:     { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },
    childPoints:   { fontFamily: typography.family.black, fontSize: typography.size.sm },

    // Nav card (pendentes)
    navCard:       {
      flexDirection: 'row', alignItems: 'center', gap: spacing['3'],
      borderRadius: radii.outer, borderWidth: 1, padding: spacing['4'],
    },
    navCardEmoji:  { fontSize: 28 },
    navCardBody:   { flex: 1 },
    navCardTitle:  { fontFamily: typography.family.bold, fontSize: typography.size.md },
    navCardSub:    { fontFamily: typography.family.medium, fontSize: typography.size.xs, marginTop: 2 },

    // Quick grid
    quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'] },
    quickCard:     {
      width: '30%',
      flexGrow: 1,
      borderRadius: radii.inner, borderWidth: 1,
      paddingVertical: spacing['4'], alignItems: 'center', gap: spacing['1'],
    },
    quickEmoji:    { fontSize: 24 },
    quickLabel:    { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },
    quickBadge:    { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
    quickBadgeText:{ color: '#fff', fontFamily: typography.family.black, fontSize: 10 },

    // Sair
    sairBtn:       { borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing['3'], alignItems: 'center', alignSelf: 'center', paddingHorizontal: spacing['8'], marginTop: spacing['2'] },
    sairTexto:     { fontFamily: typography.family.medium, fontSize: typography.size.sm },
  });
}
