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
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, Eye, Info, Lock, User } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { HomeFooterBar } from '@/components/ui/home-footer-bar';
import { useAdminFooterItems } from '@/hooks/use-footer-items';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataSheet } from '@/components/profile/personal-data-sheet';
import { ChangePasswordSheet } from '@/components/profile/change-password-sheet';
import { ThemeCard } from '@/components/profile/theme-card';
import { NotificationCard } from '@/components/profile/notification-card';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { signOut } from '@lib/auth';
import { setNotificationPrefs, type NotificationPrefs } from '@lib/notifications';
import {
  useProfile,
  useCurrentAuthUser,
  useNotificationPrefs,
  useDeleteAccount,
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
  const authUserQuery = useCurrentAuthUser();
  const notificationPrefsQuery = useNotificationPrefs();
  const { isLoading } = combineQueryStates(profileQuery, authUserQuery, notificationPrefsQuery);

  const profile = profileQuery.data ?? null;
  const authUser = authUserQuery.data ?? null;
  const email = authUser?.email ?? '';
  const avatarUri = authUser?.avatarUrl ?? null;

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
  const deleteAccountMutation = useDeleteAccount();

  const effectivePrefs = notificationPreferences ?? notificationPrefsQuery.data ?? null;
  const effectiveAvatarUri = localAvatarUri ?? avatarUri;
  const effectiveName = localName ?? profile?.nome ?? 'A';

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

  if (!isLoading && !authUser) {
    router.replace('/(auth)/login');
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
              name={effectiveName}
              avatarUri={effectiveAvatarUri}
              onAvatarChange={setLocalAvatarUri}
            />

            {/* Dados pessoais */}
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

            {/* Ferramentas */}
            <SectionCard title="Ferramentas" colors={colors} styles={styles}>
              <MenuRow
                icon={Eye}
                label="Ver app como filho"
                disabled
                disabledHint="Em breve"
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
                <Text style={[styles.versionText, { color: colors.text.muted }]}>1.0.0</Text>
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
  <View
    style={[
      styles.sectionCard,
      { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
    ]}
  >
    <Text style={[styles.sectionTitle, { color: colors.text.secondary }]}>{title}</Text>
    {children}
  </View>
);

// ── Reusable menu row ────────────────────────────────────

type MenuRowProps = Readonly<{
  icon: typeof Lock;
  label: string;
  disabled?: boolean;
  disabledHint?: string;
  onPress?: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
}>;

const MenuRow = ({
  icon: Icon,
  label,
  disabled = false,
  disabledHint,
  onPress,
  colors,
  styles,
}: MenuRowProps) => (
  <Pressable
    style={({ pressed }) => [
      styles.menuRow,
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
    <ChevronRight
      size={16}
      color={disabled ? colors.text.muted : colors.text.secondary}
      strokeWidth={2}
    />
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
      paddingHorizontal: spacing['4'],
      paddingTop: spacing['3'],
      paddingBottom: spacing['1'],
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
