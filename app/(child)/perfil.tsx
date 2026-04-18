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
import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { ThemeCard } from '@/components/profile/theme-card';
import { NotificationCard } from '@/components/profile/notification-card';
import { Button } from '@/components/ui/button';
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

export default function ChildProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const profileQuery = useProfile();
  const authUserQuery = useCurrentAuthUser();
  const notificationPrefsQuery = useNotificationPrefs();
  const { isLoading } = combineQueryStates(profileQuery, authUserQuery, notificationPrefsQuery);

  const profile = profileQuery.data ?? null;
  const authUser = authUserQuery.data ?? null;
  const avatarUri = authUser?.avatarUrl ?? null;

  const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPrefs | null>(
    null,
  );
  const [notificationPreferencesError, setNotificationPreferencesError] = useState<string | null>(
    null,
  );
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const deleteAccountMutation = useDeleteAccount();

  const effectivePrefs = notificationPreferences ?? notificationPrefsQuery.data ?? null;
  const effectiveAvatarUri = localAvatarUri ?? avatarUri;
  const effectiveName = profile?.nome ?? 'Campeão';

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
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
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
  );
}

const styles = StyleSheet.create({
  loadingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['6'], gap: spacing['4'] },
});
