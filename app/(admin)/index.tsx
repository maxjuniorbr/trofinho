import * as Sentry from '@sentry/react-native';
import {
  AppState,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  Users,
  Gift,
  ShoppingBag,
  House,
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
import { radii,
  spacing,
  typography,
  type ThemeColors,
} from '@/constants/theme';
import { Avatar } from '@/components/ui/avatar';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { AdminHomeScreenSkeleton } from '@/components/ui/skeleton';
import { HomeFooterBar, FOOTER_BAR_HEIGHT, type FooterItem } from '@/components/ui/home-footer-bar';

const FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  {
    icon: ClipboardList,
    label: 'Tarefas',
    rota: '/(admin)/tasks',
  },
  { icon: Users, label: 'Filhos', rota: '/(admin)/children' },
  { icon: Gift, label: 'Prêmios', rota: '/(admin)/prizes' },
  {
    icon: ShoppingBag,
    label: 'Resgates',
    rota: '/(admin)/redemptions',
  },
];

function getSummaryColors(colors: ThemeColors) {
  const isLight = colors.statusBar === 'dark';
  return isLight
    ? {
        bg: colors.bg.surface,
        boxBg: colors.bg.muted,
        border: colors.border.subtle,
        text: colors.text.primary,
        textMuted: colors.text.secondary,
      }
    : {
        bg: colors.bg.elevated,
        boxBg: colors.bg.muted,
        border: colors.border.subtle,
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

  const footerItems = useMemo(
    () =>
      FOOTER_ITEMS.map((item) => {
        if (item.rota === '/(admin)/tasks') return { ...item, badge: pendingValidationCount };
        if (item.rota === '/(admin)/redemptions') return { ...item, badge: pendingRedemptionCount };
        return item;
      }),
    [pendingValidationCount, pendingRedemptionCount],
  );

  const handleNavigate = useCallback(
    (rota: string) => {
      if (rota !== 'index') router.push(rota as never);
    },
    [router],
  );

  if (isLoading) {
    return (
      <SafeScreenFrame topInset bottomInset>
        <AdminHomeScreenSkeleton />
      </SafeScreenFrame>
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
    <SafeScreenFrame topInset bottomInset={false}>
      <StatusBar style={colors.statusBar} />
      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        overScrollMode="never"
        bounces={false}
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: spacing['6'],
            paddingBottom: FOOTER_BAR_HEIGHT + spacing['4'],
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

        <View style={[styles.summaryCard, { backgroundColor: summary.bg, borderColor: summary.border }]}>
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
            <View style={[styles.summaryBox, { backgroundColor: summary.boxBg, borderColor: summary.border }]}>
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>LIVRE</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {totalLivre.toLocaleString('pt-BR')}
              </Text>
            </View>
            <View style={[styles.summaryBox, { backgroundColor: summary.boxBg, borderColor: summary.border }]}>
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>COFRINHO</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {totalCofrinho.toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        </View>


        {children.length > 0 ? (
          <View style={styles.childrenList}>
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Filhos</Text>
              {children.map((item) => {
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
        ) : null}
      </ScrollView>
      <HomeFooterBar items={footerItems} activeRoute="index" onNavigate={handleNavigate} />
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { paddingHorizontal: spacing.screen },

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
      borderWidth: 1,
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
      borderWidth: 1,
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

    sectionTitle: { fontFamily: typography.family.bold, fontSize: typography.size.md },

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
      height: 8,
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


  });
}
