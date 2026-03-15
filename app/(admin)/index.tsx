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
import { getProfile, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listAdminTasks } from '@lib/tasks';
import { listAdminBalances, type BalanceWithChild } from '@lib/balances';
import { getGreeting } from '@lib/utils';
import { listChildren } from '@lib/children';
import type { Child } from '@lib/tasks';
import { countPendingRedemptions } from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/avatar';
import { PointsDisplay } from '@/components/ui/points-display';
import { Badge } from '@/components/ui/badge';

type Family = { nome: string };

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [family, setFamily] = useState<Family | null>(null);
  const [children, setChildren] = useState<Child[]>([]);
  const [balancesMap, setBalancesMap] = useState<Map<string, BalanceWithChild>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pendingValidationCount, setPendingValidationCount] = useState(0);
  const [pendingRedemptionCount, setPendingRedemptionCount] = useState(0);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerY       = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(headerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.spring(headerY, { toValue: 0, friction: 8, tension: 55, useNativeDriver: true }),
      ]).start();
    }
  }, [loading, headerOpacity, headerY]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, { data: tarefas }, { data: childrenData }, { data: balancesData }, { data: redemptionCount }] = await Promise.all([
        getProfile(),
        listAdminTasks(),
        listChildren(),
        listAdminBalances(),
        countPendingRedemptions(),
      ]);

      setProfile(p);
      setAvatarUri(p?.avatarUrl ?? null);
      setPendingValidationCount(tarefas.reduce((acc, t) => acc + t.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length, 0));
      setChildren(childrenData);
      setBalancesMap(new Map(balancesData.map((s) => [s.filho_id, s])));
      setPendingRedemptionCount(redemptionCount);

      if (p?.familia_id) {
        const { data: fam } = await supabase.from('familias').select('nome').eq('id', p.familia_id).single();
        setFamily(fam);
      } else {
        setFamily(null);
      }
    } catch {
      setFamily(null);
      setChildren([]);
      setBalancesMap(new Map());
      setPendingValidationCount(0);
      setPendingRedemptionCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas, paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  const totalPoints = Array.from(balancesMap.values()).reduce((acc, s) => acc + s.saldo_livre + s.cofrinho, 0);

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg.canvas }}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + spacing['6'] }]}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style={colors.statusBar} />

      <Animated.View
        style={[styles.hero, { opacity: headerOpacity, transform: [{ translateY: headerY }] }]}
      >
        <View style={styles.heroText}>
          <Text style={[styles.heroSub, { color: colors.text.secondary }]}>{getGreeting()} 👋</Text>
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            Olá, {profile?.nome ?? 'Admin'}
          </Text>
          {family ? (
            <Text style={[styles.heroFamily, { color: colors.accent.admin }]}>{family.nome}</Text>
          ) : null}
        </View>
        <Pressable
          onPress={() => router.push('/(admin)/perfil')}
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil"
        >
          <View style={styles.avatarWrapper}>
            <Avatar name={profile?.nome ?? 'A'} size={52} imageUri={avatarUri} />
            <View style={[styles.editBadge, { backgroundColor: colors.accent.admin }]}>
              <Text style={styles.editBadgeIcon}>✏️</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>

      <Animated.View
        style={[styles.statsRow, { opacity: headerOpacity }]}
      >
        <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <Text style={[styles.statValue, { color: colors.brand.vivid }]}>{children.length}</Text>
          <Text style={[styles.statLabel, { color: colors.text.secondary }]}>filhos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <PointsDisplay value={totalPoints} label="pts família" variant="gold" size="sm" />
        </View>
        {pendingValidationCount > 0 ? (
          <View style={[styles.statCard, { backgroundColor: colors.semantic.errorBg, borderColor: colors.semantic.error + '40' }]}>
            <Text style={[styles.statValue, { color: colors.semantic.error }]}>{pendingValidationCount}</Text>
            <Text style={[styles.statLabel, { color: colors.semantic.error }]}>pendentes</Text>
          </View>
        ) : null}
      </Animated.View>

      {children.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Seus filhos</Text>
            <Pressable onPress={() => router.push('/(admin)/children')} accessibilityRole="button">
              <Text style={[styles.sectionLink, { color: colors.brand.vivid }]}>Ver todos</Text>
            </Pressable>
          </View>
          <FlatList
            data={children}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.childrenList}
            renderItem={({ item }) => {
              const saldo = balancesMap.get(item.id);
              const pts = saldo ? saldo.saldo_livre + saldo.cofrinho : 0;
              return (
                <Pressable
                  style={[styles.childCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}
                  onPress={() => router.push(`/(admin)/balances/${item.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.nome}, ${pts} pontos`}
                >
                  <Avatar name={item.nome} size={48} />
                  <Text style={[styles.childName, { color: colors.text.primary }]} numberOfLines={1}>
                    {item.nome}
                  </Text>
                  <Text style={[styles.childPoints, { color: colors.brand.vivid }]}>
                    {pts.toLocaleString('pt-BR')} pts
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>
      ) : null}

      {pendingValidationCount > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Pendentes</Text>
              <View style={[styles.countBadge, { backgroundColor: colors.semantic.error }]}>
                <Text style={styles.countBadgeText}>{pendingValidationCount}</Text>
              </View>
            </View>
            <Pressable onPress={() => router.push('/(admin)/tasks')} accessibilityRole="button">
              <Text style={[styles.sectionLink, { color: colors.brand.vivid }]}>Ver todas</Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.navCard, { backgroundColor: colors.bg.surface, borderColor: colors.semantic.error + '40' }, shadows.card]}
            onPress={() => router.push('/(admin)/tasks')}
            accessibilityRole="button"
            accessibilityLabel={`${pendingValidationCount} tarefas aguardando validação`}
          >
            <Text style={styles.navCardEmoji}>📋</Text>
            <View style={styles.navCardBody}>
              <Text style={[styles.navCardTitle, { color: colors.text.primary }]}>Tarefas</Text>
              <Text style={[styles.navCardSub, { color: colors.text.secondary }]}>
                {pendingValidationCount} {pendingValidationCount === 1 ? 'tarefa aguardando' : 'tarefas aguardando'} validação
              </Text>
            </View>
            <Badge label="Validar" variant="error" />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Ações rápidas</Text>
        <View style={styles.quickGrid}>
          {([
            { emoji: '📋', label: 'Tarefas',    rota: '/(admin)/tasks',       badge: pendingValidationCount },
            { emoji: '👨‍👧', label: 'Filhos',     rota: '/(admin)/children',    badge: 0                      },
            { emoji: '💰', label: 'Saldos',     rota: '/(admin)/balances',    badge: 0                      },
            { emoji: '🎁', label: 'Prêmios',    rota: '/(admin)/prizes',      badge: 0                      },
            { emoji: '🛍️', label: 'Resgates',   rota: '/(admin)/redemptions', badge: pendingRedemptionCount  },
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

    </ScrollView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    loading:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:     { flexGrow: 1, paddingHorizontal: spacing.screen, paddingBottom: spacing['12'] },

    hero:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['5'] },
    heroText:      { flex: 1, paddingRight: spacing['4'] },

    avatarWrapper: { position: 'relative' },
    editBadge:     {
      position: 'absolute', bottom: 0, right: 0,
      width: 20, height: 20, borderRadius: radii.full,
      alignItems: 'center', justifyContent: 'center',
    },
    editBadgeIcon: { fontSize: 10 },
    heroSub:       { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle:     { fontFamily: typography.family.black, fontSize: typography.size['2xl'], marginTop: spacing['1'] },
    heroFamily:    { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginTop: spacing['1'] },

    statsRow:      { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['6'] },
    statCard:      {
      flex: 1, borderRadius: radii.inner, borderWidth: 1,
      padding: spacing['3'], alignItems: 'center',
    },
    statValue:     { fontFamily: typography.family.black, fontSize: typography.size.xl },
    statLabel:     { fontFamily: typography.family.semibold, fontSize: typography.size.xs, marginTop: spacing['1'] },

    section:       { marginBottom: spacing['6'] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing['3'] },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    sectionTitle:  { fontFamily: typography.family.bold, fontSize: typography.size.md },
    sectionLink:   { fontFamily: typography.family.bold, fontSize: typography.size.sm, minHeight: 44, textAlignVertical: 'center' },
    countBadge:    { width: 24, height: 24, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
    countBadgeText:{ color: '#fff', fontFamily: typography.family.black, fontSize: typography.size.xs },

    childrenList:  { gap: spacing['3'] },
    childCard:     {
      width: 120, borderRadius: radii.inner, borderWidth: 1,
      padding: spacing['3'], alignItems: 'center', gap: spacing['2'],
    },
    childName:     { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },
    childPoints:   { fontFamily: typography.family.black, fontSize: typography.size.sm },

    navCard:       {
      flexDirection: 'row', alignItems: 'center', gap: spacing['3'],
      borderRadius: radii.outer, borderWidth: 1, padding: spacing['4'],
    },
    navCardEmoji:  { fontSize: 28 },
    navCardBody:   { flex: 1 },
    navCardTitle:  { fontFamily: typography.family.bold, fontSize: typography.size.md },
    navCardSub:    { fontFamily: typography.family.medium, fontSize: typography.size.xs, marginTop: spacing['1'] },

    quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'] },
    quickCard:     {
      width: '30%',
      flexGrow: 1,
      borderRadius: radii.inner, borderWidth: 1,
      paddingVertical: spacing['4'], alignItems: 'center', gap: spacing['1'],
    },
    quickEmoji:    { fontSize: 24 },
    quickLabel:    { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },
    quickBadge:    { position: 'absolute', top: spacing['2'], right: spacing['2'], minWidth: 20, height: 20, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing['1'] },
    quickBadgeText:{ color: '#fff', fontFamily: typography.family.black, fontSize: 10 },

  });
}
