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
  Gift,
  House,
  ShoppingBag,
  PiggyBank,
  Bell,
  User,
  ChevronRight,
  CheckCircle2,
  Clock,
  Wallet,
  AlertTriangle,
  Camera,
  Send,
  RotateCcw,
} from 'lucide-react-native';
import { getGreeting } from '@lib/utils';
import { getAssignmentPoints, getAssignmentRetryState, formatWeekdays } from '@lib/tasks';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/context/theme-context';
import { useImpersonation } from '@/context/impersonation-context';
import { radii, shadows, spacing, staticTextColors, typography } from '@/constants/theme';
import { gradients, heroPalette } from '@/constants/shadows';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { InlineMessage } from '@/components/ui/inline-message';
import { HomeScreenSkeleton } from '@/components/ui/skeleton';
import { HomeFooterBar, FOOTER_BAR_HEIGHT, type FooterItem } from '@/components/ui/home-footer-bar';
import { TaskPointsPill } from '@/components/tasks/task-points-pill';

const FOOTER_ITEMS: readonly FooterItem[] = [
  { icon: House, label: 'Início', rota: 'index' },
  { icon: ClipboardList, label: 'Tarefas', rota: '/(child)/tasks' },
  { icon: Gift, label: 'Prêmios', rota: '/(child)/prizes' },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(child)/redemptions' },
  { icon: User, label: 'Perfil', rota: '/(child)/perfil' },
];

export default function FilhoHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const { impersonating } = useImpersonation();
  const isReadOnly = impersonating !== null;

  const profileQuery = useProfile();
  const profile = profileQuery.data ?? null;
  const firstName = impersonating ? impersonating.childName.split(' ')[0] : (profile?.nome?.split(' ')[0] ?? 'Campeão');
  const unreadNotifs = useChildUnreadNotifCount();
  const bellLabel = unreadNotifs > 0 ? `Notificações, ${unreadNotifs} não lidas` : 'Notificações';

  const familyQuery = useFamily(profile?.familia_id);

  const assignmentsQuery = useChildAssignments();
  useRenewRecurringTasks(impersonating?.childId);
  const assignments = useMemo(
    () => assignmentsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assignmentsQuery.data],
  );

  const balanceQuery = useBalance(impersonating?.childId);
  const balanceData = balanceQuery.data ?? null;

  const { isLoading, error, refetchAll } = combineQueryStates(
    profileQuery,
    familyQuery,
    assignmentsQuery,
    balanceQuery,
  );

  const pendingCount = useMemo(
    () => assignments.filter((a) => a.status === 'pendente' || (a.status === 'rejeitada' && getAssignmentRetryState(a).canRetry)).length,
    [assignments],
  );

  const pendingTasks = useMemo(
    () => assignments.filter((a) => a.status === 'pendente' || (a.status === 'rejeitada' && getAssignmentRetryState(a).canRetry)),
    [assignments],
  );

  const completedCount = useMemo(
    () => assignments.filter((a) => a.status === 'aprovada').length,
    [assignments],
  );

  const freeBalance = balanceData?.saldo_livre ?? 0;
  const piggyBank = balanceData?.cofrinho ?? 0;
  const totalBalance = freeBalance + piggyBank;
  const cofrinhoPercent = totalBalance > 0 ? Math.round((piggyBank / totalBalance) * 100) : 0;
  const livrePercent = 100 - cofrinhoPercent;

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
      <SafeScreenFrame topInset={!impersonating} bottomInset>
        <StatusBar style={colors.statusBar} />
        <HomeScreenSkeleton />
      </SafeScreenFrame>
    );
  }

  if (error) {
    Sentry.captureException(error);
  }

  return (
    <SafeScreenFrame topInset={!impersonating} bottomInset={false}>
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
              {getGreeting()}
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
        </View>

        {showNotificationBanner ? <NotificationPermissionBanner /> : null}

        {/* Summary card — navy gradient "MEUS PONTOS" */}
        <Pressable
          onPress={() => router.push('/(child)/balance')}
          accessibilityRole="button"
          accessibilityLabel={`Saldo total: ${totalBalance} pontos, ver detalhes`}
          style={({ pressed }) => [pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <LinearGradient
            colors={gradients.heroNavy.colors}
            locations={gradients.heroNavy.locations}
            start={gradients.heroNavy.start}
            end={gradients.heroNavy.end}
            style={styles.summaryCard}
          >
            <View style={styles.summaryHeaderRow}>
              <View style={styles.summaryHeaderLeft}>
                <Wallet size={16} color={heroPalette.textOnNavyMuted} strokeWidth={2} />
                <Text style={styles.summaryHeaderText}>MEUS PONTOS</Text>
              </View>
              <ChevronRight size={16} color={heroPalette.textOnNavySubtle} strokeWidth={2} />
            </View>
            <Text style={styles.summaryTotal}>
              {totalBalance.toLocaleString('pt-BR')}{' '}
              <Text style={styles.summaryTotalUnit}>pts</Text>
            </Text>
            <Text style={styles.summarySubtitle}>disponíveis</Text>

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
              <View style={styles.summaryBox}>
                <Text style={styles.summaryBoxLabel}>LIVRE</Text>
                <Text style={styles.summaryBoxValue}>
                  {freeBalance.toLocaleString('pt-BR')}
                </Text>
              </View>
              <View style={styles.summaryBox}>
                <View style={styles.summaryBoxLabelRow}>
                  <PiggyBank size={14} color={heroPalette.textOnNavySubtle} strokeWidth={1.5} />
                  <Text style={styles.summaryBoxLabel}>COFRINHO</Text>
                </View>
                <Text style={styles.summaryBoxValue}>
                  {piggyBank.toLocaleString('pt-BR')}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Pressable>

        {freeBalance === 0 && piggyBank === 0 ? (
          <Text style={[styles.zeroBalanceHint, { color: colors.text.muted }]}>
            Complete tarefas para ganhar seus primeiros pontos!
          </Text>
        ) : null}

        {/* Minhas tarefas — preview section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Minhas tarefas</Text>
          <Pressable
            onPress={() => router.push('/(child)/tasks' as never)}
            accessibilityRole="button"
            accessibilityLabel="Ver todas as tarefas"
            style={styles.seeAllBtn}
          >
            <Text style={[styles.seeAllText, { color: colors.accent.filho }]}>Ver todas</Text>
            <ChevronRight size={14} color={colors.accent.filho} strokeWidth={2} />
          </Pressable>
        </View>

        {pendingTasks.length === 0 ? (
          <Text style={[styles.emptyTasksHint, { color: colors.text.muted }]}>
            Nada para hoje! 🎉
          </Text>
        ) : (
          <View style={styles.taskList}>
            {pendingTasks.map((task) => (
              <PendingTaskCard
                key={task.id}
                task={task}
                isReadOnly={isReadOnly}
                colors={colors}
                styles={styles}
                onPress={() => router.push(`/(child)/tasks/${task.id}` as never)}
              />
            ))}
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.semantic.successBg }]}>
              <CheckCircle2 size={16} color={colors.semantic.success} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{completedCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>CONCLUÍDAS</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
            <View style={[styles.statIconBox, { backgroundColor: colors.accent.filhoBg }]}>
              <PiggyBank size={16} color={colors.accent.filho} strokeWidth={2.5} />
            </View>
            <View>
              <Text style={[styles.statValue, { color: colors.text.primary }]}>{piggyBank}</Text>
              <Text style={[styles.statLabel, { color: colors.text.muted }]}>POUPANDO</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <HomeFooterBar items={footerItems} activeRoute="index" onNavigate={handleNavigate} />
    </SafeScreenFrame>
  );
}

type PendingTaskCardProps = Readonly<{
  task: (typeof import('@/hooks/queries'))['useChildAssignments'] extends () => { data?: { pages: Array<{ data: Array<infer T> }> } } ? T : never;
  isReadOnly: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}>;

function PendingTaskCard({ task, isReadOnly, colors, styles, onPress }: PendingTaskCardProps) {
  const isRejected = task.status === 'rejeitada';
  const requiresEvidence = task.exige_evidencia_snapshot;

  return (
    <View
      style={[
        styles.taskCard,
        {
          backgroundColor: colors.bg.surface,
          borderColor: isRejected ? colors.semantic.error + '66' : colors.border.subtle,
          ...shadows.card,
        },
      ]}
    >
      <View style={styles.taskCardRow}>
        <View style={[styles.taskIconCircle, { backgroundColor: isRejected ? colors.semantic.errorBg : colors.bg.muted }]}>
          {isRejected
            ? <AlertTriangle size={16} color={colors.semantic.error} strokeWidth={2} />
            : <Clock size={16} color={colors.text.muted} strokeWidth={2} />}
        </View>
        <View style={styles.taskCardInfo}>
          <Text style={[styles.taskCardTitle, { color: colors.text.primary }]} numberOfLines={2}>
            {task.titulo_snapshot}
          </Text>
          <View style={styles.taskCardMeta}>
            <Text style={[styles.taskCardMetaText, { color: colors.text.muted }]}>
              {formatWeekdays(task.tarefas.dias_semana)}
            </Text>
            {requiresEvidence ? (
              <View style={[styles.taskCardBadge, { backgroundColor: colors.bg.muted }]}>
                <Camera size={10} color={colors.text.muted} strokeWidth={2} />
                <Text style={[styles.taskCardBadgeText, { color: colors.text.muted }]}>Foto</Text>
              </View>
            ) : null}
            {isRejected ? (
              <View style={[styles.taskCardBadge, { backgroundColor: colors.semantic.errorBg }]}>
                <Text style={[styles.taskCardBadgeText, { color: colors.semantic.error }]}>Rejeitada</Text>
              </View>
            ) : null}
          </View>
        </View>
        <TaskPointsPill points={getAssignmentPoints(task)} />
      </View>

      <Pressable
        style={[
          styles.taskActionBtn,
          { backgroundColor: isRejected ? colors.semantic.error : colors.brand.vivid },
          isReadOnly && { opacity: 0.45 },
        ]}
        onPress={onPress}
        disabled={isReadOnly}
        accessibilityRole="button"
        accessibilityLabel={isRejected ? `Refazer tarefa ${task.titulo_snapshot}` : `Concluir tarefa ${task.titulo_snapshot}`}
        accessibilityState={{ disabled: isReadOnly }}
      >
        {isRejected ? (
          <>
            <RotateCcw size={14} color={colors.text.inverse} strokeWidth={2.5} />
            <Text style={[styles.taskActionText, { color: colors.text.inverse }]}>Refazer e reenviar</Text>
          </>
        ) : requiresEvidence ? (
          <>
            <Camera size={14} color={colors.text.onBrand} strokeWidth={2.5} />
            <Text style={[styles.taskActionText, { color: colors.text.onBrand }]}>Enviar com foto</Text>
          </>
        ) : (
          <>
            <Send size={14} color={colors.text.onBrand} strokeWidth={2.5} />
            <Text style={[styles.taskActionText, { color: colors.text.onBrand }]}>Marcar como feita</Text>
          </>
        )}
      </Pressable>
    </View>
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
      borderCurve: 'continuous',
      padding: spacing['5'],
      gap: spacing['1'],
      marginBottom: spacing['4'],
    },
    summaryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['1'],
    },
    summaryHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1.5'],
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
      borderCurve: 'continuous',
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['4'],
      alignItems: 'center',
      gap: spacing['1'],
    },
    summaryBoxLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
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

    zeroBalanceHint: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      textAlign: 'center',
      marginBottom: spacing['2'],
      fontStyle: 'italic',
    },

    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['3'],
      marginTop: spacing['2'],
    },
    sectionTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.md,
    },
    seeAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    seeAllText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
    },
    emptyTasksHint: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      textAlign: 'center',
      paddingVertical: spacing['4'],
    },
    taskCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: 14,
    },
    taskCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    taskIconCircle: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    taskCardInfo: {
      flex: 1,
      minWidth: 0,
    },
    taskCardTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
    },
    taskCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: spacing['1.5'],
      marginTop: spacing['0.5'],
    },
    taskCardMetaText: {
      fontFamily: typography.family.semibold,
      fontSize: 11,
    },
    taskCardBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      paddingHorizontal: spacing['1.5'],
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    taskCardBadgeText: {
      fontFamily: typography.family.bold,
      fontSize: 10,
    },
    taskActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1.5'],
      marginTop: spacing['3'],
      paddingVertical: spacing['2'],
      borderRadius: radii.lg,
    },
    taskActionText: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.xs,
    },
    taskList: {
      gap: spacing['2'] + spacing['0.5'],
      marginBottom: spacing['4'],
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing['3'],
      marginTop: spacing['4'],
      marginBottom: spacing['4'],
    },
    statCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      padding: 14,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
    },
    statIconBox: {
      width: 36,
      height: 36,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statValue: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.lg,
      lineHeight: typography.size.lg * 1.2,
    },
    statLabel: {
      fontFamily: typography.family.semibold,
      fontSize: 10,
      textTransform: 'uppercase',
    },
  });
}
