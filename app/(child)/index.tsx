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
import { signOut, getProfile, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listChildAssignments } from '@lib/tasks';
import { getBalance } from '@lib/balances';
import { getGreeting } from '@lib/utils';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PointsDisplay } from '@/components/ui/points-display';

const mascotImage       = require('../../assets/trofinho-mascot.png');
const celebratingImage  = require('../../assets/trofinho-celebrating.png');

type Family = { nome: string };

export default function FilhoHomeScreen() {
  const router  = useRouter();
  const { colors } = useTheme();
  const styles  = useMemo(() => makeStyles(), []);
  const insets  = useSafeAreaInsets();

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [family,       setFamily]       = useState<Family | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loggingOut,   setLoggingOut]   = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [freeBalance,  setFreeBalance]  = useState(0);
  const [piggyBank,    setPiggyBank]    = useState(0);

  const hasPending = pendingCount > 0;
  const pendingTaskLabel = pendingCount === 1 ? 'tarefa pendente' : 'tarefas pendentes';

  const heroOpacity    = useRef(new Animated.Value(0)).current;
  const heroY          = useRef(new Animated.Value(20)).current;
  const mascotScale    = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(heroOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(heroY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
        Animated.spring(mascotScale, { toValue: 1, friction: 5, tension: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, heroOpacity, heroY, mascotScale]);

  const loadData = useCallback(async () => {
    setLoading(true);
    // Reset animations for re-focus
    heroOpacity.setValue(0);
    heroY.setValue(20);
    mascotScale.setValue(0.5);
    try {
      const p = await getProfile();
      setProfile(p);
      if (p?.familia_id) {
        const { data: fam } = await supabase.from('familias').select('nome').eq('id', p.familia_id).single();
        setFamily(fam);
      } else {
        setFamily(null);
      }
      const { data: atribuicoes } = await listChildAssignments();
      setPendingCount(atribuicoes.filter((a) => a.status === 'pendente').length);
      const { data: s } = await getBalance();
      setFreeBalance(s?.saldo_livre ?? 0);
      setPiggyBank(s?.cofrinho ?? 0);
    } catch {
      setFamily(null);
      setPendingCount(0);
      setFreeBalance(0);
      setPiggyBank(0);
    } finally {
      setLoading(false);
    }
  }, [heroOpacity, heroY, mascotScale]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleSignOut() { setLoggingOut(true); await signOut(); }

  if (loading) {
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

      <Animated.View
        style={[styles.hero, { opacity: heroOpacity, transform: [{ translateY: heroY }] }]}
      >
        <View style={styles.heroContent}>
          <Text style={[styles.heroSub, { color: colors.text.secondary }]}>{getGreeting()} 🏆</Text>
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            Olá, {profile?.nome ?? 'Campeão'}!
          </Text>
          {family ? (
            <Text style={[styles.heroFamily, { color: colors.accent.filho }]}>{family.nome}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={handleSignOut}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel={loggingOut ? 'Saindo' : 'Sair'}
          style={({ pressed }) => [
            styles.sairBtnHeader,
            { borderColor: colors.border.default, opacity: (loggingOut || pressed) ? 0.5 : 1 },
          ]}
        >
          <Text style={[styles.sairBtnHeaderText, { color: colors.text.secondary }]}>Sair</Text>
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.mascotContainer, { transform: [{ scale: mascotScale }] }]}>
        <Image
          source={hasPending ? mascotImage : celebratingImage}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel={hasPending ? 'Trofinho animado' : 'Trofinho celebrando'}
        />
        <Text style={[styles.mascotCaption, { color: colors.text.secondary }]}>
          {hasPending ? 'Vamos conquistar o dia?' : 'Troféu conquistado! 🎉'}
        </Text>
      </Animated.View>

      <Animated.View style={[styles.balanceGrid, { opacity: heroOpacity }]}>
        <View
          style={[
            styles.balanceCard,
            { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
            shadows.goldGlow,
          ]}
          accessibilityLabel={`Saldo livre: ${freeBalance} pontos`}
        >
          <Text style={[styles.balanceLabel, { color: colors.text.secondary }]}>Livre</Text>
          <PointsDisplay value={freeBalance} label="pontos" variant="gold" size="lg" />
        </View>
        <View
          style={[
            styles.balanceCard,
            { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
            shadows.card,
          ]}
          accessibilityLabel={`Cofrinho: ${piggyBank} pontos`}
        >
          <Text style={[styles.balanceLabel, { color: colors.text.secondary }]}>Cofrinho</Text>
          <PointsDisplay value={piggyBank} label="pontos" variant="amber" size="lg" />
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: heroOpacity, width: '100%' }}>
        <Pressable
          style={({ pressed }) => [
            styles.tarefasCard,
            {
              backgroundColor: colors.bg.surface,
              borderColor: hasPending ? colors.semantic.error + '50' : colors.border.subtle,
            },
            shadows.card,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => router.push('/(child)/tasks')}
          accessibilityRole="button"
          accessibilityLabel={hasPending ? `${pendingCount} tarefas pendentes` : 'Minhas Tarefas'}
        >
          <Text style={styles.tarefasEmoji}>📋</Text>
          <View style={styles.tarefasBody}>
            <Text style={[styles.tarefasTitle, { color: colors.text.primary }]}>Minhas Tarefas</Text>
            <Text style={[styles.tarefasSub, { color: colors.text.secondary }]}>
              {hasPending
                ? `${pendingCount} ${pendingTaskLabel}`
                : 'Tudo em dia!'}
            </Text>
          </View>
          {hasPending ? (
            <View style={[styles.pendenteBadge, { backgroundColor: colors.semantic.error }]}>
              <Text style={styles.pendenteBadgeText}>{pendingCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </Animated.View>

      <Animated.View style={[styles.quickGrid, { opacity: heroOpacity }]}>
        {([
          { emoji: '🎁', label: 'Prêmios',  rota: '/(child)/prizes'      as never },
          { emoji: '🛍️', label: 'Resgates', rota: '/(child)/redemptions' as never },
          { emoji: '💰', label: 'Saldo',    rota: '/(child)/balance'     as never },
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

    </ScrollView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    loading:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:       { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.screen, paddingBottom: spacing['12'] },

    hero:            { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', marginBottom: spacing['4'] },
    heroContent:     { flex: 1, alignItems: 'center' },
    heroSub:         { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle:       { fontFamily: typography.family.black, fontSize: typography.size['3xl'], marginTop: spacing['1'], textAlign: 'center' },
    heroFamily:      { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginTop: spacing['1'] },

    mascotContainer: { alignItems: 'center', marginBottom: spacing['6'] },
    mascotImage:     { width: 120, height: 120 },
    mascotCaption:   { fontFamily: typography.family.medium, fontSize: typography.size.sm, marginTop: spacing['2'] },

    balanceGrid:     { flexDirection: 'row', gap: spacing['3'], width: '100%', marginBottom: spacing['4'] },
    balanceCard:     {
      flex: 1, borderRadius: radii.outer, borderWidth: 1,
      padding: spacing['4'], alignItems: 'center', gap: spacing['2'],
    },
    balanceLabel:    { fontFamily: typography.family.bold, fontSize: typography.size.xs, textTransform: 'uppercase', letterSpacing: 0.6 },

    tarefasCard:     {
      flexDirection: 'row', alignItems: 'center', gap: spacing['3'],
      borderRadius: radii.outer, borderWidth: 1, padding: spacing['4'],
      width: '100%', marginBottom: spacing['4'],
    },
    tarefasEmoji:    { fontSize: 28 },
    tarefasBody:     { flex: 1 },
    tarefasTitle:    { fontFamily: typography.family.bold, fontSize: typography.size.md },
    tarefasSub:      { fontFamily: typography.family.medium, fontSize: typography.size.xs, marginTop: spacing['1'] },
    pendenteBadge:   { width: 24, height: 24, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
    pendenteBadgeText: { color: '#fff', fontFamily: typography.family.black, fontSize: typography.size.xs },

    quickGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'], width: '100%', marginBottom: spacing['6'] },
    quickCard:       {
      flex: 1, minWidth: 90,
      borderRadius: radii.inner, borderWidth: 1,
      paddingVertical: spacing['4'], alignItems: 'center', gap: spacing['1'],
    },
    quickEmoji:      { fontSize: 24 },
    quickLabel:      { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },

    sairBtnHeader:   { borderWidth: 1, borderRadius: radii.md, paddingVertical: spacing['1'], paddingHorizontal: spacing['3'], minHeight: 32, justifyContent: 'center' },
    sairBtnHeaderText: { fontFamily: typography.family.medium, fontSize: typography.size.xs },
  });
}
