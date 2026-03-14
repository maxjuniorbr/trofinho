import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarAtribuicoesFilho } from '@lib/tarefas';
import { buscarSaldo } from '@lib/saldos';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PointsDisplay } from '@/components/ui/points-display';

const mascotImage       = require('../../assets/trofinho-mascot.png');
const celebratingImage  = require('../../assets/trofinho-celebrating.png');

type Familia = { nome: string };

export default function FilhoHomeScreen() {
  const router  = useRouter();
  const { colors } = useTheme();
  const styles  = useMemo(() => makeStyles(colors), [colors]);
  const insets  = useSafeAreaInsets();

  const [profile,    setProfile]    = useState<UserProfile | null>(null);
  const [familia,    setFamilia]    = useState<Familia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo,     setSaindo]     = useState(false);
  const [pendentes,  setPendentes]  = useState(0);
  const [saldoLivre, setSaldoLivre] = useState(0);
  const [cofrinho,   setCofrinho]   = useState(0);

  const hasPendentes = pendentes > 0;

  // ─── Entrance animations ────────────────────────────────────
  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroY          = useRef(new Animated.Value(20)).current;
  const mascotScale    = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!carregando) {
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(heroY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
        Animated.spring(mascotScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [carregando, heroOpacity, heroY, mascotScale]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    // Reset animations for re-focus
    heroOpacity.setValue(0);
    heroY.setValue(20);
    mascotScale.setValue(0.5);
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
  }, [heroOpacity, heroY, mascotScale]);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  async function handleSair() { setSaindo(true); await signOut(); }

  if (carregando) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.filho} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg.canvas }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing['6'] }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={colors.statusBar} />

      {/* ── Hero ───────────────────────────────────────── */}
      <Animated.View
        style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
      >
        <Text style={[styles.heroSub, { color: colors.text.secondary }]}>Bom dia 🏆</Text>
        <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
          Olá, {profile?.nome ?? 'Campeão'}!
        </Text>
        {familia ? (
          <Text style={[styles.heroFamily, { color: colors.accent.filho }]}>{familia.nome}</Text>
        ) : null}
      </Animated.View>

      {/* ── Mascote ────────────────────────────────────── */}
      <Animated.View style={[styles.mascotContainer, { transform: [{ scale: mascotScale }] }]}>
        <Image
          source={hasPendentes ? mascotImage : celebratingImage}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel={hasPendentes ? 'Trofinho animado' : 'Trofinho celebrando'}
        />
        <Text style={[styles.mascotCaption, { color: colors.text.secondary }]}>
          {hasPendentes ? 'Vamos conquistar o dia?' : 'Troféu conquistado! 🎉'}
        </Text>
      </Animated.View>

      {/* ── Balance grid ───────────────────────────────── */}
      <Animated.View style={[styles.balanceGrid, { opacity: heroOpacity }]}>
        <View
          style={[
            styles.balanceCard,
            { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
            shadows.goldGlow,
          ]}
          accessibilityLabel={`Saldo livre: ${saldoLivre} pontos`}
        >
          <Text style={[styles.balanceLabel, { color: colors.text.secondary }]}>Livre</Text>
          <PointsDisplay value={saldoLivre} label="pontos" variant="gold" size="lg" />
        </View>
        <View
          style={[
            styles.balanceCard,
            { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
            shadows.card,
          ]}
          accessibilityLabel={`Cofrinho: ${cofrinho} pontos`}
        >
          <Text style={[styles.balanceLabel, { color: colors.text.secondary }]}>Cofrinho</Text>
          <PointsDisplay value={cofrinho} label="pontos" variant="amber" size="lg" />
        </View>
      </Animated.View>

      {/* ── Tarefas nav card ───────────────────────────── */}
      <Animated.View style={{ opacity: heroOpacity, width: '100%' }}>
        <Pressable
          style={({ pressed }) => [
            styles.tarefasCard,
            {
              backgroundColor: colors.bg.surface,
              borderColor: hasPendentes ? colors.semantic.error + '50' : colors.border.subtle,
            },
            shadows.card,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push('/(filho)/tarefas')}
          accessibilityRole="button"
          accessibilityLabel={hasPendentes ? `${pendentes} tarefas pendentes` : 'Minhas Tarefas'}
        >
          <Text style={styles.tarefasEmoji}>📋</Text>
          <View style={styles.tarefasBody}>
            <Text style={[styles.tarefasTitle, { color: colors.text.primary }]}>Minhas Tarefas</Text>
            <Text style={[styles.tarefasSub, { color: colors.text.secondary }]}>
              {hasPendentes
                ? `${pendentes} ${pendentes === 1 ? 'tarefa pendente' : 'tarefas pendentes'}`
                : 'Tudo em dia!'}
            </Text>
          </View>
          {hasPendentes ? (
            <View style={[styles.pendenteBadge, { backgroundColor: colors.semantic.error }]}>
              <Text style={styles.pendenteBadgeText}>{pendentes}</Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      {/* ── Quick nav 2-col ────────────────────────────── */}
      <Animated.View style={[styles.quickGrid, { opacity: heroOpacity }]}>
        {([
          { emoji: '🎁', label: 'Prêmios',  rota: '/(filho)/premios'  as never },
          { emoji: '🛍️', label: 'Resgates', rota: '/(filho)/resgates' as never },
          { emoji: '💰', label: 'Saldo',    rota: '/(filho)/saldo'    as never },
        ]).map(({ emoji, label, rota }) => (
          <Pressable
            key={rota}
            style={({ pressed }) => [
              styles.quickCard,
              { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              shadows.card,
              pressed && { opacity: 0.8 },
            ]}
            onPress={() => router.push(rota)}
            accessibilityRole="button"
            accessibilityLabel={label}
          >
            <Text style={styles.quickEmoji}>{emoji}</Text>
            <Text style={[styles.quickLabel, { color: colors.text.primary }]}>{label}</Text>
          </Pressable>
        ))}
      </Animated.View>

      {/* ── Sair ───────────────────────────────────────── */}
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
    loading:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:       { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.screen, paddingBottom: spacing['12'] },

    // Hero
    hero:            { alignItems: 'center', marginBottom: spacing['4'] },
    heroSub:         { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle:       { fontFamily: typography.family.black, fontSize: typography.size['3xl'], marginTop: 2, textAlign: 'center' },
    heroFamily:      { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginTop: 4 },

    // Mascote
    mascotContainer: { alignItems: 'center', marginBottom: spacing['6'] },
    mascotImage:     { width: 120, height: 120 },
    mascotCaption:   { fontFamily: typography.family.medium, fontSize: typography.size.sm, marginTop: spacing['2'] },

    // Balance grid
    balanceGrid:     { flexDirection: 'row', gap: spacing['3'], width: '100%', marginBottom: spacing['4'] },
    balanceCard:     {
      flex: 1, borderRadius: radii.outer, borderWidth: 1,
      padding: spacing['4'], alignItems: 'center', gap: spacing['2'],
    },
    balanceLabel:    { fontFamily: typography.family.bold, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 0.6 },

    // Tarefas card
    tarefasCard:     {
      flexDirection: 'row', alignItems: 'center', gap: spacing['3'],
      borderRadius: radii.outer, borderWidth: 1, padding: spacing['4'],
      width: '100%', marginBottom: spacing['4'],
    },
    tarefasEmoji:    { fontSize: 28 },
    tarefasBody:     { flex: 1 },
    tarefasTitle:    { fontFamily: typography.family.bold, fontSize: typography.size.md },
    tarefasSub:      { fontFamily: typography.family.medium, fontSize: typography.size.xs, marginTop: 2 },
    pendenteBadge:   { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    pendenteBadgeText: { color: '#fff', fontFamily: typography.family.black, fontSize: typography.size.xs },

    // Quick grid
    quickGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'], width: '100%', marginBottom: spacing['6'] },
    quickCard:       {
      flex: 1, minWidth: 90,
      borderRadius: radii.inner, borderWidth: 1,
      paddingVertical: spacing['4'], alignItems: 'center', gap: spacing['1'],
    },
    quickEmoji:      { fontSize: 24 },
    quickLabel:      { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },

    // Sair
    sairBtn:         { borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing['3'], paddingHorizontal: spacing['8'], alignSelf: 'center' },
    sairTexto:       { fontFamily: typography.family.medium, fontSize: typography.size.sm },
  });
}
