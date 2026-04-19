import * as Sentry from '@sentry/react-native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ChevronRight, Info, Lock, User } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataSheet } from '@/components/profile/personal-data-sheet';
import { ChangePasswordSheet } from '@/components/profile/change-password-sheet';
import { ThemeCard } from '@/components/profile/theme-card';
import { NotificationCard } from '@/components/profile/notification-card';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
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

export default function ChildProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const sectionStyles = useMemo(() => makeSectionStyles(), []);

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
  const effectiveName = localName ?? profile?.nome ?? 'Campeão';

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir conta',
      'Todos os seus dados serão apagados permanentemente. Essa ação não pode ser desfeita.',
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

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      Sentry.captureException(e);
      setLoggingOut(false);
    }
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
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bg.canvas }}
        behavior="padding"
      >
        <SafeScreenFrame bottomInset>
          <StatusBar style={colors.statusBar} />
          <ScreenHeader title="Meu Perfil" onBack={() => router.back()} role="filho" />

          {isLoading ? (
            <View style={styles.loadingContent}>
              <ActivityIndicator size="large" color={colors.accent.filho} />
            </View>
          ) : (
            <ScrollView
              style={{ backgroundColor: colors.bg.canvas }}
              overScrollMode="never"
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <AvatarSection
                name={effectiveName}
                email={email}
                avatarUri={effectiveAvatarUri}
                role="filho"
                onAvatarChange={setLocalAvatarUri}
              />

              <ThemeCard role="filho" />

              {effectivePrefs ? (
                <NotificationCard
                  preferences={effectivePrefs}
                  saving={savingNotificationPreferences}
                  error={notificationPreferencesError}
                  role="filho"
                  onPreferencesChange={handleNotificationPreferencesChange}
                />
              ) : null}

              <SectionCard title="Dados pessoais" colors={colors} styles={sectionStyles}>
                <MenuRow
                  icon={User}
                  label="Alterar dados pessoais"
                  onPress={() => setShowPersonalData(true)}
                  colors={colors}
                  styles={sectionStyles}
                />
              </SectionCard>

              <SectionCard title="Segurança" colors={colors} styles={sectionStyles}>
                <MenuRow
                  icon={Lock}
                  label="Alterar senha"
                  onPress={() => setShowChangePassword(true)}
                  colors={colors}
                  styles={sectionStyles}
                />
              </SectionCard>

              <SectionCard title="Sobre" colors={colors} styles={sectionStyles}>
                <View style={sectionStyles.menuRow}>
                  <View style={sectionStyles.menuRowLeft}>
                    <Info size={16} color={colors.text.secondary} strokeWidth={2} />
                    <Text style={[sectionStyles.menuRowLabel, { color: colors.text.primary }]}>
                      Versão
                    </Text>
                  </View>
                  <Text style={[sectionStyles.versionText, { color: colors.text.muted }]}>
                    1.0.0
                  </Text>
                </View>
              </SectionCard>

              <LogoutButton onPress={handleSignOut} loading={loggingOut} />

              <Button
                variant="danger"
                label="Excluir minha conta"
                loadingLabel="Excluindo…"
                loading={deleteAccountMutation.isPending}
                onPress={handleDeleteAccount}
                accessibilityLabel="Excluir minha conta"
              />
            </ScrollView>
          )}
        </SafeScreenFrame>
      </KeyboardAvoidingView>

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

type SectionCardProps = Readonly<{
  title: string;
  colors: ThemeColors;
  styles: ReturnType<typeof makeSectionStyles>;
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

type MenuRowProps = Readonly<{
  icon: typeof Lock;
  label: string;
  onPress: () => void;
  colors: ThemeColors;
  styles: ReturnType<typeof makeSectionStyles>;
}>;

const MenuRow = ({ icon: Icon, label, onPress, colors, styles }: MenuRowProps) => (
  <Pressable
    style={({ pressed }) => [styles.menuRow, pressed && { backgroundColor: colors.bg.muted }]}
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={label}
  >
    <View style={styles.menuRowLeft}>
      <Icon size={16} color={colors.text.secondary} strokeWidth={2} />
      <Text style={[styles.menuRowLabel, { color: colors.text.primary }]}>{label}</Text>
    </View>
    <ChevronRight size={16} color={colors.text.secondary} strokeWidth={2} />
  </Pressable>
);

const styles = StyleSheet.create({
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['6'], gap: spacing['4'] },
});

function makeSectionStyles() {
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
    menuRowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    menuRowLabel: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
    },
    versionText: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
    },
  });
}
