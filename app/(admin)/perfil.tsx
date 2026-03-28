import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { LogoutButton } from '@/components/ui/logout-button';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataCard } from '@/components/profile/personal-data-card';
import { PasswordCard } from '@/components/profile/password-card';
import { ThemeCard } from '@/components/profile/theme-card';
import {
  NotificationCard,
} from '@/components/profile/notification-card';
import { useTheme } from '@/context/theme-context';
import { spacing } from '@/constants/theme';
import { getCurrentAuthUser, getProfile, signOut, type UserProfile } from '@lib/auth';
import { captureException } from '@lib/sentry';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  setNotificationPrefs,
  type NotificationPrefs,
} from '@lib/notifications';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPreferences, setNotificationPreferencesState] = useState<NotificationPrefs>(
    DEFAULT_NOTIFICATION_PREFS,
  );
  const [notificationPreferencesError, setNotificationPreferencesError] = useState<string | null>(null);
  const [savingNotificationPreferences, setSavingNotificationPreferences] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        try {
          const [p, authUser, notificationPrefs] = await Promise.all([
            getProfile(),
            getCurrentAuthUser(),
            getNotificationPrefs(),
          ]);

          if (!active) return;

          if (!authUser) {
            router.replace('/(auth)/login');
            return;
          }

          setProfile(p);
          setEmail(authUser.email);
          setAvatarUri(authUser.avatarUrl);
          setNotificationPreferencesState(notificationPrefs);
          setNotificationPreferencesError(null);
        } finally {
          if (active) setLoading(false);
        }
      }

      load();
      return () => { active = false; };
    }, [router]),
  );

  const handleSignOut = async () => {
    setLoggingOut(true);
    try { await signOut(); } catch (e) { captureException(e); setLoggingOut(false); }
  };

  async function handleNotificationPreferencesChange(next: NotificationPrefs) {
    const previous = notificationPreferences;

    setNotificationPreferencesState(next);
    setNotificationPreferencesError(null);
    setSavingNotificationPreferences(true);

    try {
      await setNotificationPrefs(next);
    } catch (e) {
      captureException(e);
      setNotificationPreferencesState(previous);
      setNotificationPreferencesError('Não foi possível salvar as preferências agora.');
    } finally {
      setSavingNotificationPreferences(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
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
            name={profile?.nome ?? 'A'}
            avatarUri={avatarUri}
            onAvatarChange={setAvatarUri}
          />

          <PersonalDataCard
            profile={profile}
            email={email}
            onNameUpdated={(name) => setProfile((prev) => prev ? { ...prev, nome: name } : null)}
          />

          <PasswordCard />

          <ThemeCard />

          <NotificationCard
            preferences={notificationPreferences}
            saving={savingNotificationPreferences}
            error={notificationPreferencesError}
            onPreferencesChange={handleNotificationPreferencesChange}
          />

          <LogoutButton onPress={handleSignOut} loading={loggingOut} />
        </ScrollView>
      </SafeScreenFrame>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['12'], gap: spacing['4'] },
});
