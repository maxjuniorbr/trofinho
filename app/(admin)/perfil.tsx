import * as Sentry from '@sentry/react-native';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, Eye, Info, Lock, User, Users } from 'lucide-react-native';
import { getAppVersion } from '@lib/app-version';
import { ScreenHeader } from '@/components/ui/screen-header';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useAdminFooterItems } from '@/hooks/use-footer-items';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataSheet } from '@/components/profile/personal-data-sheet';
import { ChangePasswordSheet } from '@/components/profile/change-password-sheet';
import { ChildSelectionSheet } from '@/components/profile/child-selection-sheet';
import { ThemeCard } from '@/components/profile/theme-card';
import { NotificationCard } from '@/components/profile/notification-card';
import { AdminManagementSheet } from '@/components/profile/admin-management-sheet';
import { RemoveAdminSheet } from '@/components/profile/remove-admin-sheet';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { useImpersonation } from '@/context/impersonation-context';
import { signOut } from '@lib/auth';
import { setNotificationPrefs, type NotificationPrefs } from '@lib/notifications';
import type { FamilyAdmin } from '@lib/admin-invite';
import {
  useProfile,
  useFamily,
  useCurrentAuthUser,
  useNotificationPrefs,
  useDeleteAccount,
  useChildrenList,
  useAdminInvite,
  useFamilyAdmins,
  useGenerateInvite,
  useCancelInvite,
  useRemoveCoAdmin,
  combineQueryStates,
} from '@/hooks/queries';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerItems = useAdminFooterItems();

  const handleFooterNavigate = useCallback(
    (rota: string) => {
      if (rota === '/(admin)/perfil') return;
      if (rota === 'index') router.dismissTo('/(admin)');
      else router.replace(rota as never);
    },
    [router],
  );

  const profileQuery = useProfile();
  const familyQuery = useFamily(profileQuery.data?.familia_id);
  const authUserQuery = useCurrentAuthUser();
  const notificationPrefsQuery = useNotificationPrefs();
  const { isLoading } = combineQueryStates(
    profileQuery,
    familyQuery,
    authUserQuery,
    notificationPrefsQuery,
  );

  const profile = profileQuery.data ?? null;
  const family = familyQuery.data ?? null;
  const authUser = authUserQuery.data ?? null;
  const email = authUser?.email ?? '';
  const avatarUri = authUser?.avatarUrl ?? null;

  // Admin invite hooks
  const familyAdminsQuery = useFamilyAdmins();
  const adminInviteQuery = useAdminInvite(profile?.familia_id);
  const generateInviteMutation = useGenerateInvite();
  const cancelInviteMutation = useCancelInvite();
  const removeCoAdminMutation = useRemoveCoAdmin();

  const admins = familyAdminsQuery.data ?? [];
  const pendingInvite = adminInviteQuery.data ?? null;

  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [localName, setLocalName] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPrefs | null>(
    null,
  );
  const [notificationPreferencesError, setNotificationPreferencesError] = useState<string | null>(
    null,
  );
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPersonalData, setShowPersonalData] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showChildSelection, setShowChildSelection] = useState(false);

  const [showAdminManagement, setShowAdminManagement] = useState(false);
  const [showRemoveAdminSheet, setShowRemoveAdminSheet] = useState(false);
  const [adminToRemove, setAdminToRemove] = useState<FamilyAdmin | null>(null);
  const deleteAccountMutation = useDeleteAccount();

  const { data: allChildren = [] } = useChildrenList();
  const hasActiveChildren = useMemo(
    () => allChildren.some((c) => c.ativo === true),
    [allChildren],
  );
  const { startImpersonation } = useImpersonation();

  const effectivePrefs = notificationPreferences ?? notificationPrefsQuery.data ?? null;
  const effectiveAvatarUri = localAvatarUri ?? avatarUri;
  const effectiveName = localName ?? profile?.nome ?? 'A';
  const familyDisplayName = family ? `Família ${family.nome}` : effectiveName;

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      Sentry.captureException(e);
      setLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Todos os dados da família serão apagados permanentemente. Essa ação não pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir conta',
          style: 'destructive',
          onPress: () => deleteAccountMutation.mutate(),
        },
      ],
    );
  };

  const handleNotificationPreferencesChange = async (next: NotificationPrefs) => {
    const previous = effectivePrefs;

    setNotificationPreferences(next);
    setNotificationPreferencesError(null);
    setSavingNotificationPreferences(true);

    try {
      await setNotificationPrefs(next);
    } catch (e) {
      Sentry.captureException(e);
      setNotificationPreferences(previous);
      setNotificationPreferencesError('Não foi possível salvar as preferências agora.');
    } finally {
      setSavingNotificationPreferences(false);
    }
  };

  const handleGenerateInvite = useCallback(() => {
    generateInviteMutation.mutate(undefined);
  }, [generateInviteMutation]);

  const handleCancelInvite = useCallback(
    (inviteId: string) => {
      cancelInviteMutation.mutate(inviteId);
    },
    [cancelInviteMutation],
  );

  const handleRemoveAdmin = useCallback((admin: FamilyAdmin) => {
    setAdminToRemove(admin);
    setShowRemoveAdminSheet(true);
  }, []);

  const handleConfirmRemoveAdmin = useCallback(() => {
    if (!adminToRemove) return;
    removeCoAdminMutation.mutate(adminToRemove.id, {
      onSuccess: () => {
        setShowRemoveAdminSheet(false);
        setAdminToRemove(null);
      },
    });
  }, [adminToRemove, removeCoAdminMutation]);

  useEffect(() => {
    if (!isLoading && !authUser) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, authUser, router]);

  if (!isLoading && !authUser) {
    return null;
  }

  return (
    <>
      <SafeScreenFrame bottomInset={false}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Meu Perfil" />

        {isLoading ? (
          <View style={staticStyles.loadingContent}>
            <ActivityIndicator size="large" color={colors.brand.vivid} />
          </View>
        ) : (
          <ScrollView
            style={{ backgroundColor: colors.bg.canvas }}
            overScrollMode="never"
            contentContainerStyle={staticStyles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <AvatarSection
              name={familyDisplayName}
              email={email}
              avatarUri={effectiveAvatarUri}
              onAvatarChange={setLocalAvatarUri}
            />

            {/* Aparência */}
            <ThemeCard />

            {/* Notificações */}
            {effectivePrefs ? (
              <NotificationCard
                preferences={effectivePrefs}
                saving={savingNotificationPreferences}
                error={notificationPreferencesError}
                onPreferencesChange={handleNotificationPreferencesChange}
              />
            ) : null}

            {/* Família */}
            <SectionCard title="Família" colors={colors} styles={styles}>
              <MenuRow
                icon={Users}
                label="Administradores"
                rightText={`${admins.length}/2`}
                onPress={() => setShowAdminManagement(true)}
                colors={colors}
                styles={styles}
                hasBorder
              />
              <MenuRow
                icon={Eye}
                label="Ver app como filho"
                disabled={!hasActiveChildren}
                disabledHint={hasActiveChildren ? undefined : 'Sem filhos'}
                onPress={() => setShowChildSelection(true)}
                colors={colors}
                styles={styles}
              />
            </SectionCard>
            <SectionCard title="Dados pessoais" colors={colors} styles={styles}>
              <MenuRow
                icon={User}
                label="Alterar dados pessoais"
                onPress={() => setShowPersonalData(true)}
                colors={colors}
                styles={styles}
              />
            </SectionCard>

            {/* Segurança */}
            <SectionCard title="Segurança" colors={colors} styles={styles}>
              <MenuRow
                icon={Lock}
                label="Alterar senha"
                onPress={() => setShowChangePassword(true)}
                colors={colors}
                styles={styles}
              />
            </SectionCard>

            {/* Sobre */}
            <SectionCard title="Sobre" colors={colors} styles={styles}>
              <View style={[styles.menuRow, styles.menuRowBorder]}>
                <View style={styles.menuRowLeft}>
                  <Info size={16} color={colors.text.secondary} strokeWidth={2} />
                  <Text style={[styles.menuRowLabel, { color: colors.text.primary }]}>Versão</Text>
                </View>
                <Text style={[styles.versionText, { color: colors.text.muted }]}>
                  {getAppVersion()}
                </Text>
              </View>
            </SectionCard>

            <LogoutButton onPress={handleSignOut} loading={loggingOut} />

            <Pressable
              style={[styles.deleteBtn, { borderColor: withAlpha(colors.semantic.error, 0.375) }]}
              onPress={handleDeleteAccount}
              disabled={deleteAccountMutation.isPending}
              accessibilityRole="button"
              accessibilityLabel="Excluir minha conta"
            >
              <Text style={[styles.deleteBtnText, { color: colors.semantic.error }]}>
                {deleteAccountMutation.isPending ? 'Excluindo…' : 'Excluir minha conta'}
              </Text>
            </Pressable>
          </ScrollView>
        )}
        <HomeFooterBar
          items={footerItems}
          activeRoute="/(admin)/perfil"
          onNavigate={handleFooterNavigate}
        />
      </SafeScreenFrame>

      <PersonalDataSheet
        visible={showPersonalData}
        onClose={() => setShowPersonalData(false)}
        profile={profile}
        email={email}
        onNameUpdated={(name) => setLocalName(name)}
      />

      <ChangePasswordSheet
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <ChildSelectionSheet
        visible={showChildSelection}
        onClose={() => setShowChildSelection(false)}
        onSelectChild={(child) => {
          setShowChildSelection(false);
          startImpersonation({ childId: child.id, childName: child.nome });
          router.replace('/(child)' as never);
        }}
      />

      <AdminManagementSheet
        visible={showAdminManagement}
        onClose={() => setShowAdminManagement(false)}
        admins={admins}
        currentUserId={profile?.id}
        pendingInvite={pendingInvite}
        onGenerateInvite={handleGenerateInvite}
        onCancelInvite={handleCancelInvite}
        onRemoveAdmin={handleRemoveAdmin}
        generatingInvite={generateInviteMutation.isPending}
        cancellingInvite={cancelInviteMutation.isPending}
      />

      <RemoveAdminSheet
        visible={showRemoveAdminSheet}
        onClose={() => {
          setShowRemoveAdminSheet(false);
          setAdminToRemove(null);
        }}
        adminName={adminToRemove?.nome ?? ''}
        onConfirm={handleConfirmRemoveAdmin}
        isRemoving={removeCoAdminMutation.isPending}
      />
    </>
  );
}

// ── Reusable section card ────────────────────────────────

type SectionCardProps = Readonly<{
  title: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  children: React.ReactNode;
}>;

const SectionCard = ({ title, colors, styles, children }: SectionCardProps) => (
  <View>
    <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>{title}</Text>
    <View
      style={[
        styles.sectionCard,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      {children}
    </View>
  </View>
);

// ── Reusable menu row ────────────────────────────────────

type MenuRowProps = Readonly<{
  icon: typeof Lock;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
  rightText?: string;
  hasBorder?: boolean;
  onPress?: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

const MenuRow = ({
  icon: Icon,
  label,
  disabled = false,
  disabledHint,
  rightText,
  hasBorder = false,
  onPress,
  colors,
  styles,
}: MenuRowProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.menuRow,
      hasBorder && styles.menuRowBorder,
      pressed && !disabled && { backgroundColor: colors.bg.muted },
    ]}
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled }}
  >
    <View style={styles.menuRowLeft}>
      <Icon
        size={16}
        color={disabled ? colors.text.muted : colors.text.secondary}
        strokeWidth={2}
      />
      <Text
        style={[styles.menuRowLabel, { color: disabled ? colors.text.muted : colors.text.primary }]}
      >
        {label}
      </Text>
      {disabled && disabledHint ? (
        <View style={[styles.hintBadge, { backgroundColor: colors.bg.muted }]}>
          <Text style={[styles.hintBadgeText, { color: colors.text.muted }]}>{disabledHint}</Text>
        </View>
      ) : null}
    </View>
    <View style={styles.menuRowRight}>
      {rightText ? (
        <Text style={[styles.menuRowRightText, { color: colors.text.muted }]}>{rightText}</Text>
      ) : null}
      <ChevronRight
        size={16}
        color={disabled ? colors.text.muted : colors.text.secondary}
        strokeWidth={2}
      />
    </View>
  </Pressable>
);

// ── Styles ───────────────────────────────────────────────

const staticStyles = StyleSheet.create({
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['6'], gap: spacing['4'] },
});

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      overflow: 'hidden',
    },
    sectionTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: spacing['1'],
      marginBottom: spacing['2'],
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing['4'],
      paddingVertical: 14,
    },
    menuRowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border.subtle,
    },
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    menuRowLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
    },
    menuRowRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    menuRowRightText: {
      fontFamily: typography.family.extrabold,
      fontSize: typography.size.xxs,
    },
    hintBadge: {
      paddingHorizontal: spacing['2'],
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    hintBadgeText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
    },
    versionText: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xs,
    },
    deleteBtn: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
      justifyContent: 'center',
    },
    deleteBtnText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
    },
  });
}
