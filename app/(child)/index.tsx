import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ClipboardList,
  Gift,
  ShoppingBag,
  Wallet,
  LogOut,
} from 'lucide-react-native';
import { signOut, getProfile, type UserProfile } from '@lib/auth';
import { getFamily, type Family } from '@lib/family';
import { listChildAssignments } from '@lib/tasks';
import { getBalance } from '@lib/balances';
import { getGreeting } from '@lib/utils';
import { isNotificationPermissionDenied } from '@lib/notifications';
import { captureException } from '@lib/sentry';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import { PointsDisplay } from '@/components/ui/points-display';
import { NotificationPermissionBanner } from '@/components/ui/notification-permission-banner';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { mascotImage, celebratingImage } from '@/constants/assets';

import type { LucideIcon } from 'lucide-react-native';

const CHILD_QUICK_ACTIONS: ReadonlyArray<{ icon: LucideIcon; label: string; rota: string }> = [
  { icon: Gift,        label: 'Prêmios',  rota: '/(child)/prizes'      },
  { icon: ShoppingBag, label: 'Resgates', rota: '/(child)/redemptions' },
  { icon: Wallet,      label: 'Saldo',    rota: '/(child)/balance'     },
];


export default function FilhoHomeScreen() {
  const router  = useRouter();
  const { colors } = useTheme();
  const styles  = useMemo(() => makeStyles(), []);

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [family,       setFamily]       = useState<Family | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [loggingOut,   setLoggingOut]   = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [freeBalance,  setFreeBalance]  = useState(0);
  const [piggyBank,    setPiggyBank]    = useState(0);
  const [showNotificationBanner, setShowNotificationBanner] = useState(false);

  const hasPending = pendingCount > 0;
  const pendingTaskLabel = pendingCount === 1 ? 'tarefa pendente' : 'tarefas pendentes';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [p, { data: atribuicoes }, { data: s }, notificationPermissionDenied] = await Promise.all([
        getProfile(),
        listChildAssignments(),
        getBalance(),
        isNotificationPermissionDenied(),
      ]);

      setProfile(p);
      setPendingCount(atribuicoes.filter((a) => a.status === 'pendente').length);
      setFreeBalance(s?.saldo_livre ?? 0);
      setPiggyBank(s?.cofrinho ?? 0);
      setShowNotificationBanner(notificationPermissionDenied);

      if (p?.familia_id) {
        const fam = await getFamily(p.familia_id);
        setFamily(fam);
      } else {
        setFamily(null);
      }
    } catch (e) {
      captureException(e);
      setFamily(null);
      setPendingCount(0);
      setFreeBalance(0);
      setPiggyBank(0);
      setShowNotificationBanner(false);
    } finally {
      setLoading(false);
    }
  }, []);

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
      >

      <View style={styles.hero}>
        <Text style={[styles.heroSub, { color: colors.text.secondary }]}>{getGreeting()} 🏆</Text>
        <Text style={[styles.heroTitle, { color: colors.text.primary }]}>
          Olá, {profile?.nome ?? 'Campeão'}!
        </Text>
        {family ? (
          <Text style={[styles.heroFamily, { color: colors.accent.filho }]}>Família {family.nome}</Text>
        ) : null}
      </View>

      {showNotificationBanner ? <NotificationPermissionBanner /> : null}

      <View style={styles.mascotContainer}>
        <Image
          source={hasPending ? mascotImage : celebratingImage}
          style={styles.mascotImage}
          resizeMode="contain"
          accessibilityLabel={hasPending ? 'Trofinho animado' : 'Trofinho celebrando'}
        />
        <Text style={[styles.mascotCaption, { color: colors.text.secondary }]}>
          {hasPending ? 'Vamos conquistar o dia?' : 'Troféu conquistado! 🎉'}
        </Text>
      </View>

      <View style={styles.balanceGrid}>
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
      </View>

      <View style={{ width: '100%' }}>
        <Pressable
          style={({ pressed }) => [
            styles.tarefasCard,
            {
              backgroundColor: colors.bg.surface,
              borderColor: hasPending ? colors.semantic.error + '50' : colors.border.subtle,
            },
            shadows.card,
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
          onPress={() => router.push('/(child)/tasks')}
          accessibilityRole="button"
          accessibilityLabel={hasPending ? `${pendingCount} tarefas pendentes` : 'Minhas Tarefas'}
        >
          <View style={[styles.tarefasIconBox, { backgroundColor: colors.accent.filhoBg }]}>
            <ClipboardList size={22} color={colors.accent.filho} strokeWidth={1.5} />
          </View>
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
              <Text style={[styles.pendenteBadgeText, { color: colors.text.inverse }]}>{pendingCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={styles.quickGrid}>
        {CHILD_QUICK_ACTIONS.map(({ icon: Icon, label, rota }) => (
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
            <View style={[styles.quickIconBox, { backgroundColor: colors.accent.filhoBg }]}>
              <Icon size={22} color={colors.accent.filho} strokeWidth={1.5} />
            </View>
            <Text style={[styles.quickLabel, { color: colors.text.primary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.btnLogout, { borderColor: colors.semantic.error + '60', opacity: loggingOut ? 0.55 : 1 }]}
        onPress={handleSignOut}
        disabled={loggingOut}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        {loggingOut
          ? <ActivityIndicator color={colors.semantic.error} />
          : (
            <View style={styles.btnLogoutInner}>
              <LogOut size={16} color={colors.semantic.error} strokeWidth={2} />
              <Text style={[styles.btnLogoutText, { color: colors.semantic.error }]}>Sair</Text>
            </View>
          )
        }
      </Pressable>

      </ScrollView>
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    loading:         { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container:       { flexGrow: 1, alignItems: 'center', paddingHorizontal: spacing.screen },

    hero:            { alignItems: 'center', width: '100%', marginBottom: spacing['4'] },
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
    tarefasIconBox:  { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    tarefasBody:     { flex: 1 },
    tarefasTitle:    { fontFamily: typography.family.bold, fontSize: typography.size.md },
    tarefasSub:      { fontFamily: typography.family.medium, fontSize: typography.size.xs, marginTop: spacing['1'] },
    pendenteBadge:   { width: 24, height: 24, borderRadius: radii.full, alignItems: 'center', justifyContent: 'center' },
    pendenteBadgeText: { fontFamily: typography.family.black, fontSize: typography.size.xs },

    quickGrid:       { flexDirection: 'row', flexWrap: 'wrap', gap: spacing['3'], width: '100%', marginBottom: spacing['6'] },
    quickCard:       {
      flex: 1, minWidth: 90,
      borderRadius: radii.inner, borderWidth: 1,
      paddingVertical: spacing['4'], alignItems: 'center', gap: spacing['1'],
    },
    quickIconBox:    { width: 44, height: 44, borderRadius: radii.md, alignItems: 'center' as const, justifyContent: 'center' as const },
    quickLabel:      { fontFamily: typography.family.bold, fontSize: typography.size.xs, textAlign: 'center' },

    btnLogout: {
      borderRadius: radii.md, borderWidth: 1,
      paddingVertical: spacing['3'], alignItems: 'center',
      minHeight: 48, justifyContent: 'center', width: '100%',
    },
    btnLogoutInner: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing['2'] },
    btnLogoutText: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
  });
}
