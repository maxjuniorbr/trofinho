import * as Sentry from '@sentry/react-native';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataCard } from '@/components/profile/personal-data-card';
import { PasswordCard } from '@/components/profile/password-card';
import { ThemeCard } from '@/components/profile/theme-card';
import { NotificationCard } from '@/components/profile/notification-card';
import { useTheme } from '@/context/theme-context';
import { spacing } from '@/constants/theme';
import { signOut } from '@lib/auth';
import { setNotificationPrefs, type NotificationPrefs } from '@lib/notifications';
import {
  useProfile,
  useCurrentAuthUser,
  useNotificationPrefs,
  useDeleteAccount,
  combineQueryStates,
} from '@/hooks/queries';
import { Button } from '@/components/ui/button';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();

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
  const deleteAccountMutation = useDeleteAccount();

  // Use query data as base, local overrides for optimistic updates
  const effectivePrefs = notificationPreferences ?? notificationPrefsQuery.data ?? null;
  const effectiveAvatarUri = localAvatarUri ?? avatarUri;
  const effectiveName = localName ?? profile?.nome ?? 'A';

  const handleSignOut = async () => {
    setLoggingOut(true);
    try {
      await signOut();
    } catch (e) {
      Sentry.captureException(e);
      console.error(e);
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
      console.error(e);
      setNotificationPreferences(previous);
      setNotificationPreferencesError('Não foi possível salvar as preferências agora.');
    } finally {
      setSavingNotificationPreferences(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  if (!authUser) {
    router.replace('/(auth)/login');
    return null;
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
      <SafeScreenFrame bottomInset>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Meu Perfil" onBack={() => router.back()} />

        <ScrollView
          style={{ backgroundColor: colors.bg.canvas }}
          overScrollMode="never"
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <AvatarSection
            name={effectiveName}
            avatarUri={effectiveAvatarUri}
            onAvatarChange={setLocalAvatarUri}
          />

          <PersonalDataCard
            profile={profile}
            email={email}
            onNameUpdated={(name) => setLocalName(name)}
          />

          <PasswordCard />

          <ThemeCard />

          {effectivePrefs ? (
            <NotificationCard
              preferences={effectivePrefs}
              saving={savingNotificationPreferences}
              error={notificationPreferencesError}
              onPreferencesChange={handleNotificationPreferencesChange}
            />
          ) : null}

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
      </SafeScreenFrame>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['12'], gap: spacing['4'] },
});
