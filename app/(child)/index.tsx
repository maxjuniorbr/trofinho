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
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { ClipboardList, Gift, ShoppingBag, UserCircle, PiggyBank } from 'lucide-react-native';
import { getGreeting } from '@lib/utils';
import { isNotificationPermissionDenied } from '@lib/notifications';
import {
  useProfile,
  useFamily,
  useChildAssignments,
  useBalance,
  useRenewDailyTasks,
  combineQueryStates,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha, type ThemeColors } from '@/constants/theme';
import { darkColors } from '@/constants/colors';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { HomeScreenSkeleton } from '@/components/ui/skeleton';
import { mascotImage, celebratingImage } from '@/constants/assets';

import type { LucideIcon } from 'lucide-react-native';

const MASCOT_CELEBRATING_PHRASES = [
  'Troféu conquistado! 🎉',
  'Tudo feito, campeão! 🏆',
  'Dia 100% completo! ⭐',
  'Você mandou muito bem! 🚀',
  'Missão cumprida! 💪',
] as const;

const CHILD_QUICK_ACTIONS: readonly {
  icon: LucideIcon;
  label: string;
  rota: string;
  badgeKey: 'tasks' | 'none';
}[] = [
  { icon: ClipboardList, label: 'Tarefas', rota: '/(child)/tasks', badgeKey: 'tasks' },
  { icon: Gift, label: 'Prêmios', rota: '/(child)/prizes', badgeKey: 'none' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(child)/redemptions', badgeKey: 'none' },
  { icon: UserCircle, label: 'Perfil', rota: '/(child)/perfil', badgeKey: 'none' },
];

function getSummaryColors(colors: ThemeColors) {
  const isLight = colors.statusBar === 'dark';
  return {
    bg: isLight ? darkColors.bg.surface : colors.bg.elevated,
    boxBg: isLight ? darkColors.bg.elevated : colors.bg.muted,
    border: isLight ? withAlpha('#FFFFFF', 0.25) : colors.border.subtle,
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

  const familyQuery = useFamily(profile?.familia_id);
  const family = familyQuery.data ?? null;

  const assignmentsQuery = useChildAssignments();
  useRenewDailyTasks();
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
      <SafeScreenFrame topInset bottomInset>
        <StatusBar style={colors.statusBar} />
        <HomeScreenSkeleton />
      </SafeScreenFrame>
    );
  }

  if (error) {
    console.error(error);
  }

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
            paddingBottom: spacing['6'],
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
          <Text style={[styles.heroSub, { color: colors.text.secondary }]}>{getGreeting()} 🏆</Text>
          <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
            Olá, {profile?.nome ?? 'Campeão'}!
          </Text>
          {family ? (
            <Text style={[styles.heroFamily, { color: colors.accent.filho }]}>
              Família {family.nome}
            </Text>
          ) : null}
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
              style={[styles.summaryBox, { backgroundColor: summary.boxBg, borderColor: summary.border }]}
              accessibilityLabel={`Saldo disponível: ${freeBalance} pontos`}
            >
              <Text style={[styles.summaryBoxLabel, { color: summary.textMuted }]}>LIVRE</Text>
              <Text style={[styles.summaryBoxValue, { color: summary.text }]}>
                {freeBalance.toLocaleString('pt-BR')}
              </Text>
            </View>
            <View
              style={[styles.summaryBox, { backgroundColor: summary.boxBg, borderColor: summary.border }]}
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

        {/* Quick actions row */}
        <View style={styles.quickRow}>
          {CHILD_QUICK_ACTIONS.map(({ icon: Icon, label, rota, badgeKey }) => {
            const badge = badgeKey === 'tasks' ? pendingCount : 0;
            return (
              <Pressable
                key={rota}
                style={({ pressed }) => [
                  styles.quickCard,
                  { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() => router.push(rota as never)}
                accessibilityRole="button"
                accessibilityLabel={badge > 0 ? `${label}, ${badge} pendentes` : label}
              >
                <View style={[styles.quickIconBox, { backgroundColor: colors.accent.filhoBg }]}>
                  <Icon size={22} color={colors.accent.filho} strokeWidth={1.5} />
                </View>
                <Text style={[styles.quickLabel, { color: colors.text.secondary }]}>{label}</Text>
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

      </ScrollView>
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.screen },

    hero: { alignItems: 'center', width: '100%', marginBottom: spacing['4'] },
    heroSub: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
    heroTitle: {
      fontFamily: typography.family.black,
      fontSize: typography.size['3xl'],
      marginTop: spacing['1'],
      textAlign: 'center',
    },
    heroFamily: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      marginTop: spacing['1'],
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

    quickRow: {
      flexDirection: 'row',
      gap: spacing['3'],
      width: '100%',
    },
    quickCard: {
      flex: 1,
      borderRadius: radii.xl,
      borderWidth: 1,
      borderCurve: 'continuous',
      paddingVertical: spacing['4'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    quickIconBox: {
      width: 44,
      height: 44,
      borderRadius: radii.md,
      borderCurve: 'continuous',
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
    quickBadgeText: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xs,
      fontVariant: ['tabular-nums'],
    },
  });
}
