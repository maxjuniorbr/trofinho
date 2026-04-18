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
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import {
  ClipboardList,
  Gift,
  House,
  ShoppingBag,
  PiggyBank,
  Pencil,
  Bell,
} from 'lucide-react-native';
import { getGreeting } from '@lib/utils';
import { isNotificationPermissionDenied } from '@lib/notifications';
import { useChildUnreadNotifCount } from '@/hooks/use-notification-inbox';
import {
  useProfile,
  useFamily,
  useChildAssignments,
  useBalance,
  useRenewRecurringTasks,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, type ThemeColors } from '@/constants/theme';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { HomeScreenSkeleton } from '@/components/ui/skeleton';
import { mascotImage, celebratingImage } from '@/constants/assets';
import { HomeFooterBar, FOOTER_BAR_HEIGHT, type FooterItem } from '@/components/ui/home-footer-bar';
import { Avatar } from '@/components/ui/avatar';

const MASCOT_CELEBRATING_PHRASES = [
  'Troféu conquistado! 🎉',
  'Tudo feito, campeão! 🏆',
  'Dia 100% completo! ⭐',
  'Você mandou muito bem! 🚀',
  'Missão cumprida! 💪',
] as const;

const FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  { icon: ClipboardList, label: 'Tarefas', rota: '/(child)/tasks' },
  { icon: Gift, label: 'Prêmios', rota: '/(child)/prizes' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(child)/redemptions' },
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

export default function FilhoHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);
  const summary = useMemo(() => getSummaryColors(colors), [colors]);

  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;
  const firstName = profile?.nome?.split(' ')[0] ?? 'Campeão';
  const avatarUri = profile?.avatarUrl ?? null;
  const unreadNotifs = useChildUnreadNotifCount();
  const bellLabel = unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações';

  const familyQuery = useFamily(profile?.familia_id);

  const assignmentsQuery = useChildAssignments();
  useRenewRecurringTasks();
  const assignments = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const balanceQuery = useBalance();
  const balanceData = balanceQuery.data ?? null;

  const { isLoading, error, refetchAll } = combineQueryStates(
    profileQuery,
    familyQuery,
    assignmentsQuery,
    balanceQuery,
  );

  const pendingCount = useMemo(
    () => assignments.filter((a) => a.status === 'pendente').length,
    [assignments],
  );

  const freeBalance = balanceData?.saldo_livre ?? 0;
  const piggyBank = balanceData?.cofrinho ?? 0;
  const totalBalance = freeBalance + piggyBank;
  const cofrinhoPercent = totalBalance > 0 ? Math.round((piggyBank / totalBalance) * 100) : 0;
  const livrePercent = 100 - cofrinhoPercent;

  const [showNotificationBanner, setShowNotificationBanner] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasPending = pendingCount > 0;
  const celebratingPhrase = useMemo(
    () => MASCOT_CELEBRATING_PHRASES[Math.floor(Math.random() * MASCOT_CELEBRATING_PHRASES.length)], // NOSONAR — non-security random: picking a display phrase
    [],
  );

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

  const footerItems = useMemo(
    () =>
      FOOTER_ITEMS.map((item) => ({
        ...item,
        badge: item.rota === '/(child)/tasks' ? pendingCount : undefined,
      })),
    [pendingCount],
  );

  const handleNavigate = useCallback(
    (rota: string) => {
      if (rota !== 'index') router.push(rota as never);
    },
    [router],
  );

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

  if (isLoading) {
    return (
      <SafeScreenFrame topInset bottomInset>
        <StatusBar style={colors.statusBar} />
        <HomeScreenSkeleton />
      </SafeScreenFrame>
    );
  }

  if (error) {
    Sentry.captureException(error);
  }

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
              {getGreeting()} 🏆
            </Text>
            <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
              Olá, {firstName}!
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(child)/notifications')}
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
          <Pressable
            onPress={() => router.push('/(child)/perfil')}
            accessibilityRole="button"
            accessibilityLabel="Abrir perfil"
          >
            <View style={styles.avatarWrapper}>
              <Avatar name={profile?.nome ?? 'C'} size={52} imageUri={avatarUri} />
              <View style={[styles.editBadge, { backgroundColor: colors.accent.filhoDim }]}>
                <Pencil size={10} color={colors.text.inverse} strokeWidth={2.5} />
              </View>
            </View>
          </Pressable>
        </View>

        {showNotificationBanner ? <NotificationPermissionBanner /> : null}

        <View style={styles.mascotContainer}>
          <Image
            source={hasPending ? mascotImage : celebratingImage}
            style={styles.mascotImage}
            contentFit="contain"
            accessibilityLabel={hasPending ? 'Trofinho animado' : 'Trofinho celebrando'}
          />
          <Text style={[styles.mascotCaption, { color: colors.text.secondary }]}>
            {hasPending ? 'Vamos conquistar o dia? 💪' : celebratingPhrase}
          </Text>
        </View>

        {/* Summary card — dark "MEU SALDO" */}
        <Pressable
          style={({ pressed }) => [
            styles.summaryCard,
            { backgroundColor: summary.bg, borderColor: summary.border },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => router.push('/(child)/balance')}
          accessibilityRole="button"
          accessibilityLabel={`Saldo total: ${totalBalance} pontos, ver detalhes`}
        >
          <Text style={[styles.summaryTitle, { color: summary.textMuted }]}>MEU SALDO</Text>
          <Text style={[styles.summaryTotal, { color: summary.text }]}>
            {totalBalance.toLocaleString('pt-BR')}
          </Text>
          <Text style={[styles.summaryUnit, { color: summary.textMuted }]}>pontos</Text>

          {totalBalance > 0 ? (
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFillLeft,
                  { flex: livrePercent, backgroundColor: colors.accent.filho },
                ]}
              />
              <View
                style={[
                  styles.progressFillRight,
                  { flex: cofrinhoPercent, backgroundColor: colors.semantic.warning },
                ]}
              />
            </View>
          ) : null}

          <View style={styles.summaryBoxRow}>
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: summary.boxBg, borderColor: summary.border },
              ]}
              accessibilityLabel={`Saldo disponível: ${freeBalance} pontos`}
            >
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>LIVRE</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {freeBalance.toLocaleString('pt-BR')}
              </Text>
            </View>
            <View
              style={[
                styles.summaryBox,
                { backgroundColor: summary.boxBg, borderColor: summary.border },
              ]}
              accessibilityLabel={`Cofrinho: ${piggyBank} pontos`}
            >
              <View style={styles.summaryBoxLabelRow}>
                <PiggyBank size={14} color={summary.textMuted} strokeWidth={1.5} />
                <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>COFRINHO</Text>
              </View>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {piggyBank.toLocaleString('pt-BR')}
              </Text>
            </View>
          </View>
        </Pressable>

        {freeBalance === 0 && piggyBank === 0 ? (
          <Text style={[styles.zeroBalanceHint, { color: colors.text.muted }]}>
            Complete tarefas para ganhar seus primeiros pontos! ⭐
          </Text>
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
      width: '100%',
      marginBottom: spacing['4'],
    },
    heroText: { flex: 1, paddingRight: spacing['4'] },
    heroSub: { fontFamily: typography.family.bold, fontSize: typography.size.sm },

    bellButton: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing['3'],
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
      color: '#FFFFFF',
    },

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

    heroTitle: {
      fontFamily: typography.family.black,
      fontSize: typography.size['2xl'],
      marginTop: spacing['1'],
      lineHeight: typography.lineHeight['3xl'],
    },

    mascotContainer: { alignItems: 'center', marginBottom: spacing['6'] },
    mascotImage: { width: 120, height: 120 },
    mascotCaption: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      marginTop: spacing['2'],
    },

    summaryCard: {
      width: '100%',
      borderRadius: radii.xl,
      borderWidth: 1,
      borderCurve: 'continuous',
      padding: spacing['5'],
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['4'],
    },
    summaryTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    summaryTotal: {
      fontFamily: typography.family.black,
      fontSize: typography.size['5xl'],
      fontVariant: ['tabular-nums'],
    },
    summaryUnit: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: spacing['2'],
    },
    progressTrack: {
      flexDirection: 'row',
      width: '100%',
      height: 8,
      borderRadius: radii.full,
      overflow: 'hidden',
      marginBottom: spacing['3'],
    },
    progressFillLeft: { borderTopLeftRadius: radii.full, borderBottomLeftRadius: radii.full },
    progressFillRight: { borderTopRightRadius: radii.full, borderBottomRightRadius: radii.full },
    summaryBoxRow: { flexDirection: 'row', gap: spacing['3'], width: '100%' },
    summaryBox: {
      flex: 1,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderCurve: 'continuous',
      padding: spacing['3'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    summaryBoxLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
    summaryBoxLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    summaryBoxValue: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xl,
      fontVariant: ['tabular-nums'],
    },

    zeroBalanceHint: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      textAlign: 'center',
      marginBottom: spacing['2'],
      fontStyle: 'italic',
    },
  });
}
