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
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { Bell, ChevronRight, TrendingUp, Wallet } from 'lucide-react-native';
import { getGreeting } from '@lib/utils';
import { isNotificationPermissionDenied } from '@lib/notifications';
import { useAdminUnreadNotifCount } from '@/hooks/use-notification-inbox';
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
import { radii, shadows, spacing, staticTextColors, typography } from '@/constants/theme';
import { gradients, heroPalette } from '@/constants/shadows';
import { Avatar } from '@/components/ui/avatar';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { AdminHomeScreenSkeleton } from '@/components/ui/skeleton';
import { HomeFooterBar, FOOTER_BAR_HEIGHT } from '@/components/ui/home-footer-bar';
import { useAdminFooterItems } from '@/hooks/use-footer-items';

export default function AdminHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;

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
  const pendingRedemptionQuery = usePendingRedemptionCount();

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
    } finally {
      setRefreshing(false);
    }
  };

  const footerItems = useAdminFooterItems();
  const unreadNotifs = useAdminUnreadNotifCount();
  const bellLabel = unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações';

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
    Sentry.captureException(error);
  }

  const balances = Array.from(balancesMap.values());
  const totalLivre = balances.reduce((acc, s) => acc + s.saldo_livre, 0);
  const totalCofrinho = balances.reduce((acc, s) => acc + s.cofrinho, 0);
  const totalPoints = totalLivre + totalCofrinho;
  const visibleChildren = children.slice(0, 3);

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
            onPress={() => router.push('/(admin)/notifications')}
            accessibilityRole="button"
            accessibilityLabel={bellLabel}
            style={({ pressed }) => [
              styles.bellButton,
              { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Bell size={18} color={colors.text.primary} strokeWidth={2} />
            {unreadNotifs > 0 ? (
              <View style={[styles.bellBadge, { backgroundColor: colors.semantic.error }]}>
                <Text style={styles.bellBadgeText}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            ) : null}
          </Pressable>
        </View>

        {showNotificationBanner ? <NotificationPermissionBanner /> : null}

        <View
          accessibilityRole="summary"
          accessibilityLabel={`Resumo da família, ${totalPoints} pontos`}
        >
          <LinearGradient
            colors={gradients.heroNavy.colors}
            locations={gradients.heroNavy.locations}
            start={gradients.heroNavy.start}
            end={gradients.heroNavy.end}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeaderLeft}>
              <Wallet size={16} color={heroPalette.textOnNavyMuted} strokeWidth={2} />
              <Text style={styles.summaryHeaderText}>RESUMO DA FAMÍLIA</Text>
            </View>
            <Text style={styles.summaryTotal}>
              {totalPoints.toLocaleString('pt-BR')} <Text style={styles.summaryTotalUnit}>pts</Text>
            </Text>
            <Text style={styles.summarySubtitle}>em circulação</Text>
            <View style={styles.summaryBoxes}>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>LIVRE</Text>
                <Text style={styles.summaryBoxValue}>{totalLivre.toLocaleString('pt-BR')}</Text>
              </View>
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>COFRINHO</Text>
                <Text style={styles.summaryBoxValue}>{totalCofrinho.toLocaleString('pt-BR')}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Filhos</Text>
            <Pressable
              onPress={() => router.push('/(admin)/children')}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Gerenciar filhos"
              style={({ pressed }) => [styles.sectionLink, pressed && { opacity: 0.65 }]}
            >
              <Text style={[styles.sectionLinkText, { color: colors.accent.adminDim }]}>
                Gerenciar
              </Text>
              <ChevronRight size={14} color={colors.accent.adminDim} strokeWidth={2.25} />
            </Pressable>
          </View>
          <View style={styles.childrenList}>
            {visibleChildren.length > 0 ? (
              visibleChildren.map((item) => {
                const saldo = balancesMap.get(item.id);
                const pts = saldo ? saldo.saldo_livre + saldo.cofrinho : 0;
                const cofrinhoPercent =
                  pts > 0 ? Math.round(((saldo?.cofrinho ?? 0) / pts) * 100) : 0;
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
                    <Avatar name={item.nome} size={40} imageUri={item.avatar_url} />
                    <View style={styles.childBody}>
                      <View style={styles.childNameRow}>
                        <Text
                          style={[styles.childName, { color: colors.text.primary }]}
                          numberOfLines={1}
                        >
                          {item.nome}
                        </Text>
                        <Text style={[styles.childPoints, { color: colors.text.primary }]}>
                          {pts.toLocaleString('pt-BR')}
                        </Text>
                      </View>
                      <View style={styles.childProgressRow}>
                        <View
                          style={[styles.childProgressTrack, { backgroundColor: colors.bg.muted }]}
                        >
                          <View
                            style={[
                              styles.childProgressFill,
                              {
                                width: `${cofrinhoPercent}%`,
                                backgroundColor: colors.accent.admin,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.childMeta, { color: colors.text.muted }]}>
                          {cofrinhoPercent}% cofrinho
                        </Text>
                      </View>
                      {appreciation > 0 ? (
                        <View style={styles.childAppreciationRow}>
                          <TrendingUp size={12} color={colors.semantic.success} strokeWidth={2} />
                          <Text
                            style={[styles.childAppreciation, { color: colors.semantic.success }]}
                          >
                            {appreciation}% ao mês
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <ChevronRight size={16} color={colors.text.muted} strokeWidth={1.75} />
                  </Pressable>
                );
              })
            ) : (
              <View
                style={[
                  styles.emptyState,
                  { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                ]}
              >
                <Text style={[styles.emptyStateText, { color: colors.text.secondary }]}>
                  Nenhum filho cadastrado
                </Text>
                <Pressable
                  onPress={() => router.push('/(admin)/children')}
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar filho"
                  style={({ pressed }) => [
                    styles.emptyStateButton,
                    { backgroundColor: colors.accent.admin },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.emptyStateButtonText, { color: colors.text.onBrand }]}>
                    Adicionar filho
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
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

    bellButton: {
      width: 44,
      height: 44,
      borderRadius: radii.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 18,
      height: 18,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    bellBadgeText: {
      fontFamily: typography.family.black,
      fontSize: 10,
      color: staticTextColors.inverse,
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
    summaryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
      marginBottom: spacing['1'],
    },
    summaryHeaderText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      letterSpacing: 0.5,
      color: heroPalette.textOnNavyMuted,
    },
    summaryTotal: {
      fontFamily: typography.family.black,
      fontSize: typography.size['5xl'],
      lineHeight: typography.lineHeight['5xl'],
      fontVariant: ['tabular-nums'],
      color: heroPalette.textOnNavy,
    },
    summaryTotalUnit: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.md,
      color: heroPalette.textOnNavySubtle,
    },
    summarySubtitle: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginBottom: spacing['3'],
      color: heroPalette.textOnNavyMuted,
    },
    summaryBoxes: { flexDirection: 'row', gap: spacing['3'] },
    summaryBox: {
      flex: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['4'],
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    summaryBoxLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
      letterSpacing: 0.5,
      color: heroPalette.textOnNavySubtle,
    },
    summaryBoxValue: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xl,
      fontVariant: ['tabular-nums'],
      color: heroPalette.textOnNavy,
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['3'],
    },
    sectionTitle: { fontFamily: typography.family.black, fontSize: typography.size.md },
    sectionLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['0.5'],
    },
    sectionLinkText: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.xs,
    },

    childrenList: { gap: spacing['2'] + spacing['0.5'] },
    childCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['3'] + spacing['0.5'],
      ...shadows.card,
    },
    childBody: { flex: 1, minWidth: 0 },
    childNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['2'],
      marginBottom: spacing['1'],
    },
    childName: { fontFamily: typography.family.bold, fontSize: typography.size.sm, flex: 1 },
    childPoints: {
      fontFamily: typography.family.black,
      fontSize: typography.size.md,
      fontVariant: ['tabular-nums'],
    },
    childProgressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    childProgressTrack: {
      flex: 1,
      height: 6,
      borderRadius: radii.full,
      overflow: 'hidden',
    },
    childProgressFill: {
      height: '100%',
      borderRadius: radii.full,
    },
    childMeta: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xxs,
      flexShrink: 0,
    },
    childAppreciationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['0.5'],
      marginTop: spacing['1'],
    },
    childAppreciation: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
    },

    emptyState: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      paddingVertical: spacing['10'],
      paddingHorizontal: spacing['6'],
      alignItems: 'center',
      gap: spacing['3'],
    },
    emptyStateText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      textAlign: 'center',
    },
    emptyStateButton: {
      paddingVertical: spacing['2'],
      paddingHorizontal: spacing['4'],
      borderRadius: radii.md,
      ...shadows.goldButton,
    },
    emptyStateButtonText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
    },
  });
}
