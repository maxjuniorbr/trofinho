import * as Sentry from '@sentry/react-native';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  Users,
  Gift,
  ShoppingBag,
  Pencil,
  ChevronRight,
  TrendingUp,
  PiggyBank,
} from 'lucide-react-native';
import { getGreeting } from '@lib/utils';
import { isNotificationPermissionDenied } from '@lib/notifications';
import {
  useProfile,
  useFamily,
  useChildrenList,
  useAdminBalances,
  usePendingValidationCount,
  usePendingRedemptionCount,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import {
  radii,
  shadows,
  spacing,
  typography,
  withAlpha,
  type ThemeColors,
} from '@/constants/theme';
import { darkColors } from '@/constants/colors';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';

import type { LucideIcon } from 'lucide-react-native';

const CHILDREN_PREVIEW_LIMIT = 3;

const QUICK_ACTIONS: readonly {
  icon: LucideIcon;
  label: string;
  rota: string;
  badgeKey: 'tasks' | 'redemptions' | 'none';
}[] = [
  {
    icon: ClipboardList,
    label: 'Tarefas',
    rota: '/(admin)/tasks',
    badgeKey: 'tasks',
  },
  { icon: Users, label: 'Filhos', rota: '/(admin)/children', badgeKey: 'none' },
  { icon: Gift, label: 'Prêmios', rota: '/(admin)/prizes', badgeKey: 'none' },
  {
    icon: ShoppingBag,
    label: 'Resgates',
    rota: '/(admin)/redemptions',
    badgeKey: 'redemptions',
  },
];

function getSummaryColors(colors: ThemeColors) {
  const isLight = colors.statusBar === 'dark';
  return {
    bg: isLight ? darkColors.bg.surface : colors.bg.elevated,
    boxBg: isLight ? darkColors.bg.elevated : colors.bg.muted,
    text: '#FFFFFF',
    textMuted: 'rgba(255, 255, 255, 0.7)',
  };
}

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;
  const avatarUri = profile?.avatarUrl ?? null;

  const familyQuery = useFamily(profile?.familia_id);
  const family = familyQuery.data ?? null;

  const childrenQuery = useChildrenList();
  const children = childrenQuery.data ?? [];

  const balancesQuery = useAdminBalances();
  const balancesMap = useMemo(
    () => new Map((balancesQuery.data ?? []).map((s) => [s.filho_id, s])),
    [balancesQuery.data],
  );

  const pendingValidationQuery = usePendingValidationCount();
  const pendingValidationCount = pendingValidationQuery.data ?? 0;

  const pendingRedemptionQuery = usePendingRedemptionCount();
  const pendingRedemptionCount = pendingRedemptionQuery.data ?? 0;

  const { isLoading, error, refetchAll } = combineQueryStates(
    profileQuery,
    familyQuery,
    childrenQuery,
    balancesQuery,
    pendingValidationQuery,
    pendingRedemptionQuery,
  );

  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const check = () => {
      isNotificationPermissionDenied()
        .then(setShowNotificationBanner)
        .catch(() => setShowNotificationBanner(false));
    };

    check();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });

    return () => sub.remove();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchAll();
      const denied = await isNotificationPermissionDenied();
      setShowNotificationBanner(denied);
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas }]}>
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  if (error) {
    console.error(error);
  }

  const balances = Array.from(balancesMap.values());
  const totalLivre = balances.reduce((acc, s) => acc + s.saldo_livre, 0);
  const totalCofrinho = balances.reduce((acc, s) => acc + s.cofrinho, 0);
  const totalPoints = totalLivre + totalCofrinho;
  const summary = getSummaryColors(colors);

  return (
    <SafeScreenFrame topInset bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        overScrollMode="never"
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: spacing['6'],
            paddingBottom: spacing['12'],
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {error ? (
          <View style={{ paddingHorizontal: spacing['4'], paddingTop: spacing['4'] }}>
            <InlineMessage
              message="Não foi possível carregar todos os dados. Puxe para atualizar."
              variant="warning"
            />
          </View>
        ) : null}

        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={[styles.heroSub, { color: colors.text.secondary }]}>
              {getGreeting()} 👋
            </Text>
            <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
              {family ? `Família ${family.nome}` : (profile?.nome ?? 'Admin')}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(admin)/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <View style={styles.avatarWrapper}>
              <Avatar name={profile?.nome ?? 'A'} size={52} imageUri={avatarUri} />
              <View style={[styles.editBadge, { backgroundColor: colors.accent.adminDim }]}>
                <Pencil size={10} color={colors.text.inverse} strokeWidth={2.5} />
              </View>
            </View>
          </Pressable>
        </View>

        {showNotificationBanner ? <NotificationPermissionBanner /> : null}

        <View style={[styles.summaryCard, { backgroundColor: summary.bg }]}>
          <View style={styles.summaryHeader}>
            <PiggyBank size={16} color={summary.textMuted} strokeWidth={2} />
            <Text style={[styles.summaryHeaderText, { color: summary.textMuted }]}>
              RESUMO DA FAMÍLIA
            </Text>
          </View>
          <Text style={[styles.summaryTotal, { color: summary.text }]}>
            {totalPoints.toLocaleString('pt-BR')}
          </Text>
          <Text style={[styles.summarySubtitle, { color: summary.textMuted }]}>
            pontos em circulação
          </Text>
          <View style={styles.summaryBoxes}>
            <View style={[styles.summaryBox, { backgroundColor: summary.boxBg }]}>
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>LIVRE</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {totalLivre.toLocaleString('pt-BR')}
              </Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: summary.boxBg }]}>
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>COFRINHO</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {totalCofrinho.toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        </View>

        {children.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Filhos</Text>
              <Pressable
                onPress={() => router.push('/(admin)/balances')}
                accessibilityRole="button"
                accessibilityLabel="Ver saldos de todos os filhos"
                hitSlop={8}
              >
                <Text style={[styles.sectionLink, { color: colors.accent.admin }]}>
                  Ver saldos {'>'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.childrenList}>
              {children.slice(0, CHILDREN_PREVIEW_LIMIT).map((item) => {
                const saldo = balancesMap.get(item.id);
                const pts = saldo ? saldo.saldo_livre + saldo.cofrinho : 0;
                const cofrinhoPercent =
                  pts > 0 ? Math.round(((saldo?.cofrinho ?? 0) / pts) * 100) : 0;
                const livrePercent = 100 - cofrinhoPercent;
                const appreciation = saldo?.indice_valorizacao ?? 0;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.childCard,
                      { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                      pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: '/(admin)/balances/[filho_id]',
                        params: { filho_id: item.id, nome: item.nome },
                      })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${item.nome}, ${pts} pontos, ver saldo`}
                  >
                    <Avatar name={item.nome} size={44} imageUri={item.avatar_url} />
                    <View style={styles.childBody}>
                      <Text
                        style={[styles.childName, { color: colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {item.nome}
                      </Text>
                      {pts > 0 ? (
                        <View style={styles.childProgressRow}>
                          <View style={styles.childProgressTrack}>
                            <View
                              style={[
                                styles.childProgressFillLeft,
                                { flex: livrePercent, backgroundColor: colors.accent.adminDim },
                              ]}
                            />
                            <View
                              style={[
                                styles.childProgressFillRight,
                                { flex: cofrinhoPercent, backgroundColor: colors.semantic.warning },
                              ]}
                            />
                          </View>
                          <Text style={[styles.childMeta, { color: colors.text.muted }]}>
                            {cofrinhoPercent}% cofrinho
                          </Text>
                        </View>
                      ) : null}
                      {appreciation > 0 ? (
                        <View style={styles.childAppreciationRow}>
                          <TrendingUp size={12} color={colors.semantic.success} strokeWidth={2} />
                          <Text style={[styles.childAppreciation, { color: colors.semantic.success }]}>
                            {appreciation}% ao mês
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.childPointsLarge, { color: colors.text.primary }]}>
                      {pts.toLocaleString('pt-BR')}
                    </Text>
                    <ChevronRight size={16} color={colors.text.muted} strokeWidth={1.75} />
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {pendingValidationCount > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Pendentes</Text>
                <View style={[styles.countBadge, { backgroundColor: colors.semantic.error }]}>
                  <Text style={[styles.countBadgeText, { color: colors.text.inverse }]}>
                    {pendingValidationCount}
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => router.push('/(admin)/tasks')}
                accessibilityRole="button"
                hitSlop={12}
              >
                <Text style={[styles.sectionLink, { color: colors.accent.admin }]}>Ver todas</Text>
              </Pressable>
            </View>
            <Pressable
              style={[
                styles.navCard,
                {
                  backgroundColor: colors.bg.surface,
                  borderColor: withAlpha(colors.semantic.error, 0.25),
                },
                shadows.card,
              ]}
              onPress={() => router.push('/(admin)/tasks')}
              accessibilityRole="button"
              accessibilityLabel={`${pendingValidationCount} tarefas aguardando validação`}
            >
              <View style={styles.navCardLead}>
                <View style={[styles.navIconBox, { backgroundColor: colors.semantic.errorBg }]}>
                  <ClipboardList size={20} color={colors.semantic.error} strokeWidth={1.75} />
                </View>
                <View style={styles.navCardBody}>
                  <Text style={[styles.navCardTitle, { color: colors.text.primary }]}>Tarefas</Text>
                  <Text style={[styles.navCardSub, { color: colors.text.secondary }]}>
                    {pendingValidationCount}{' '}
                    {pendingValidationCount === 1 ? 'tarefa aguardando' : 'tarefas aguardando'}{' '}
                    validação
                  </Text>
                </View>
              </View>
              <Badge label="Validar" variant="error" />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Ações rápidas</Text>
          <View style={styles.quickGrid}>
            {QUICK_ACTIONS.map(({ icon: Icon, label, rota, badgeKey }) => {
              let badge = 0;
              if (badgeKey === 'tasks') {
                badge = pendingValidationCount;
              } else if (badgeKey === 'redemptions') {
                badge = pendingRedemptionCount;
              }
              return (
                <Pressable
                  key={rota}
                  style={({ pressed }) => [
                    styles.quickCard,
                    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => router.push(rota as never)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={[styles.quickIconBox, { backgroundColor: colors.bg.elevated }]}>
                    <Icon size={22} color={colors.accent.admin} strokeWidth={1.5} />
                  </View>
                  <Text style={[styles.quickLabel, { color: colors.text.primary }]}>{label}</Text>
                  {badge > 0 ? (
                    <View style={[styles.quickBadge, { backgroundColor: colors.semantic.error }]}>
                      <Text style={[styles.quickBadgeText, { color: colors.text.inverse }]}>
                        {badge}
                      </Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: { flexGrow: 1, paddingHorizontal: spacing.screen },

    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['6'],
    },
    heroText: { flex: 1, paddingRight: spacing['4'] },

    avatarWrapper: { position: 'relative' },
    editBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 20,
      height: 20,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroSub: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle: {
      fontFamily: typography.family.black,
      fontSize: typography.size['2xl'],
      marginTop: spacing['1'],
      lineHeight: typography.lineHeight['3xl'],
    },

    summaryCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['5'],
      marginBottom: spacing['6'],
      gap: spacing['1'],
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      marginBottom: spacing['1'],
    },
    summaryHeaderText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      letterSpacing: 0.5,
    },
    summaryTotal: {
      fontFamily: typography.family.black,
      fontSize: typography.size['5xl'],
      lineHeight: typography.lineHeight['5xl'],
      fontVariant: ['tabular-nums'],
    },
    summarySubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginBottom: spacing['3'],
    },
    summaryBoxes: { flexDirection: 'row', gap: spacing['3'] },
    summaryBox: {
      flex: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['4'],
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    summaryBoxLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
      letterSpacing: 0.5,
    },
    summaryBoxValue: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xl,
      fontVariant: ['tabular-nums'],
    },

    section: { marginBottom: spacing['6'], gap: spacing['3'] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    sectionTitle: { fontFamily: typography.family.bold, fontSize: typography.size.md },
    sectionLink: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    countBadge: {
      width: 24,
      height: 24,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBadgeText: { fontFamily: typography.family.black, fontSize: typography.size.xs },

    childrenList: { gap: spacing['2'] },
    childCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['4'],
    },
    childBody: { flex: 1, gap: spacing['1'] },
    childName: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    childPointsLarge: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xl,
      fontVariant: ['tabular-nums'],
    },
    childProgressRow: { gap: spacing['0.5'] },
    childProgressTrack: {
      flexDirection: 'row',
      height: 6,
      borderRadius: radii.full,
      overflow: 'hidden',
      gap: 2,
    },
    childProgressFillLeft: {
      borderTopLeftRadius: radii.full,
      borderBottomLeftRadius: radii.full,
    },
    childProgressFillRight: {
      borderTopRightRadius: radii.full,
      borderBottomRightRadius: radii.full,
    },
    childMeta: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xxs,
    },
    childAppreciationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    childAppreciation: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
    },

    navCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['3'],
      borderRadius: radii.outer,
      borderWidth: 1,
      padding: spacing['4'],
    },
    navCardLead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing['3'] },
    navIconBox: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    navCardBody: { flex: 1 },
    navCardTitle: { fontFamily: typography.family.bold, fontSize: typography.size.md },
    navCardSub: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      marginTop: spacing['1'],
    },

    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'] },
    quickCard: {
      width: '30%',
      flexGrow: 1,
      borderRadius: radii.inner,
      borderWidth: 1,
      paddingVertical: spacing['4'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    quickIconBox: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    },
    quickLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      textAlign: 'center',
    },
    quickBadge: {
      position: 'absolute',
      top: spacing['2'],
      right: spacing['2'],
      minWidth: 20,
      height: 20,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing['1'],
    },
    quickBadgeText: { fontFamily: typography.family.black, fontSize: typography.size.xxs },
  });
}
