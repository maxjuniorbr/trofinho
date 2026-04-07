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
  Wallet,
  Gift,
  ShoppingBag,
  Pencil,
  ChevronRight,
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
  accent: 'neutral' | 'gold';
}[] = [
  {
    icon: ClipboardList,
    label: 'Tarefas',
    rota: '/(admin)/tasks',
    badgeKey: 'tasks',
    accent: 'neutral',
  },
  { icon: Users, label: 'Filhos', rota: '/(admin)/children', badgeKey: 'none', accent: 'neutral' },
  { icon: Wallet, label: 'Saldos', rota: '/(admin)/balances', badgeKey: 'none', accent: 'gold' },
  { icon: Gift, label: 'Prêmios', rota: '/(admin)/prizes', badgeKey: 'none', accent: 'neutral' },
  {
    icon: ShoppingBag,
    label: 'Resgates',
    rota: '/(admin)/redemptions',
    badgeKey: 'redemptions',
    accent: 'neutral',
  },
];

type MetricTone = 'neutral' | 'gold' | 'danger';

type MetricCard = Readonly<{
  key: string;
  value: string;
  label: string;
  tone: MetricTone;
}>;

function getMetricAppearance(tone: MetricTone, colors: ThemeColors) {
  if (tone === 'gold') {
    return {
      backgroundColor: colors.bg.surface,
      borderColor: colors.border.subtle,
      valueColor: colors.brand.vivid,
      labelColor: colors.text.secondary,
    };
  }

  if (tone === 'danger') {
    return {
      backgroundColor: colors.semantic.errorBg,
      borderColor: withAlpha(colors.semantic.error, 0.25),
      valueColor: colors.semantic.error,
      labelColor: colors.semantic.error,
    };
  }

  return {
    backgroundColor: colors.bg.surface,
    borderColor: colors.border.subtle,
    valueColor: colors.text.primary,
    labelColor: colors.text.secondary,
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

  const totalPoints = Array.from(balancesMap.values()).reduce(
    (acc, s) => acc + s.saldo_livre + s.cofrinho,
    0,
  );
  const metricCards: MetricCard[] = [
    {
      key: 'children',
      value: children.length.toLocaleString('pt-BR'),
      label: 'Filhos',
      tone: 'neutral',
    },
    {
      key: 'family-points',
      value: totalPoints.toLocaleString('pt-BR'),
      label: 'Pontos da família',
      tone: 'gold',
    },
    {
      key: 'pending',
      value: pendingValidationCount.toLocaleString('pt-BR'),
      label: 'Para validar',
      tone: pendingValidationCount > 0 ? 'danger' : 'neutral',
    },
  ];

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
              Olá, {profile?.nome ?? 'Admin'}
            </Text>
            {family ? (
              <View
                style={[
                  styles.familyPill,
                  { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                ]}
              >
                <Text style={[styles.heroFamily, { color: colors.accent.admin }]}>
                  Família {family.nome}
                </Text>
              </View>
            ) : null}
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

        <View style={styles.statsRow}>
          {metricCards.map((card) => {
            const metricAppearance = getMetricAppearance(card.tone, colors);

            return (
              <View
                key={card.key}
                style={[
                  styles.statCard,
                  {
                    backgroundColor: metricAppearance.backgroundColor,
                    borderColor: metricAppearance.borderColor,
                  },
                ]}
              >
                <Text style={[styles.statValue, { color: metricAppearance.valueColor }]}>
                  {card.value}
                </Text>
                <Text style={[styles.statLabel, { color: metricAppearance.labelColor }]}>
                  {card.label}
                </Text>
              </View>
            );
          })}
        </View>

        {children.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Seus filhos</Text>
              {children.length > CHILDREN_PREVIEW_LIMIT ? (
                <Pressable
                  style={[styles.seeAllBtn, { backgroundColor: colors.accent.adminBg }]}
                  onPress={() => router.push('/(admin)/children')}
                  accessibilityRole="button"
                  accessibilityLabel="Ver todos os filhos"
                  hitSlop={8}
                >
                  <Text style={[styles.seeAllBtnText, { color: colors.accent.admin }]}>
                    Ver todos
                  </Text>
                  <ChevronRight size={14} color={colors.accent.admin} strokeWidth={2} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.childrenList}>
              {children.slice(0, CHILDREN_PREVIEW_LIMIT).map((item) => {
                const saldo = balancesMap.get(item.id);
                const pts = saldo ? saldo.saldo_livre + saldo.cofrinho : 0;
                return (
                  <Pressable
                    key={item.id}
                    style={({ pressed }) => [
                      styles.childCard,
                      { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                      shadows.card,
                      pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] },
                    ]}
                    onPress={() => router.push(`/(admin)/children/${item.id}` as never)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.nome}, ver nome e e-mail`}
                  >
                    <Avatar name={item.nome} size={48} imageUri={item.avatar_url} />
                    <View style={styles.childBody}>
                      <Text
                        style={[styles.childName, { color: colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {item.nome}
                      </Text>
                      <Text style={[styles.childPoints, { color: colors.brand.vivid }]}>
                        {pts.toLocaleString('pt-BR')} pts
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.text.secondary} strokeWidth={1.75} />
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
            {QUICK_ACTIONS.map(({ icon: Icon, label, rota, badgeKey, accent }) => {
              let badge = 0;
              if (badgeKey === 'tasks') {
                badge = pendingValidationCount;
              } else if (badgeKey === 'redemptions') {
                badge = pendingRedemptionCount;
              }
              const iconColor = accent === 'gold' ? colors.brand.vivid : colors.accent.admin;
              return (
                <Pressable
                  key={rota}
                  style={({ pressed }) => [
                    styles.quickCard,
                    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                    shadows.card,
                    pressed && { opacity: 0.8, transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => router.push(rota as never)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <View style={[styles.quickIconBox, { backgroundColor: colors.bg.elevated }]}>
                    <Icon size={22} color={iconColor} strokeWidth={1.5} />
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
    familyPill: {
      marginTop: spacing['2'],
      alignSelf: 'flex-start',
      borderRadius: radii.full,
      borderWidth: 1,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['1.5'],
    },
    heroFamily: { fontFamily: typography.family.semibold, fontSize: typography.size.sm },

    statsRow: { flexDirection: 'row', gap: spacing['3'], marginBottom: spacing['6'] },
    statCard: {
      flex: 1,
      minHeight: 112,
      borderRadius: radii.inner,
      borderWidth: 1,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1'],
      borderCurve: 'continuous',
    },
    statValue: {
      fontFamily: typography.family.black,
      fontSize: typography.size['2xl'],
      lineHeight: typography.lineHeight['2xl'],
      fontVariant: ['tabular-nums'],
      textAlign: 'center',
    },
    statLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
      textAlign: 'center',
    },

    section: { marginBottom: spacing['6'], gap: spacing['3'] },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
    sectionTitle: { fontFamily: typography.family.bold, fontSize: typography.size.md },
    sectionLink: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      borderRadius: radii.md,
      paddingVertical: spacing['1.5'],
      paddingHorizontal: spacing['3'],
    },
    seeAllBtnText: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    countBadge: {
      width: 24,
      height: 24,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    countBadgeText: { fontFamily: typography.family.black, fontSize: typography.size.xs },

    childrenList: { gap: spacing['3'] },
    childCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.inner,
      borderWidth: 1,
      padding: spacing['4'],
    },
    childBody: { flex: 1, gap: spacing['1'] },
    childName: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    childPoints: { fontFamily: typography.family.black, fontSize: typography.size.sm },

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
