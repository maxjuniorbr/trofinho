import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { LogOut } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataCard } from '@/components/profile/personal-data-card';
import { PasswordCard } from '@/components/profile/password-card';
import { ThemeCard } from '@/components/profile/theme-card';
import {
  NotificationCard,
} from '@/components/profile/notification-card';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { getCurrentAuthUser, getProfile, signOut, type UserProfile } from '@lib/auth';
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

  async function handleSignOut() {
    setLoggingOut(true);
    try { await signOut(); } catch { setLoggingOut(false); }
  }

  async function handleNotificationPreferencesChange(next: NotificationPrefs) {
    const previous = notificationPreferences;

    setNotificationPreferencesState(next);
    setNotificationPreferencesError(null);
    setSavingNotificationPreferences(true);

    try {
      await setNotificationPrefs(next);
    } catch {
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
              )}
          </Pressable>
        </ScrollView>
      </SafeScreenFrame>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { padding: spacing['5'], paddingBottom: spacing['12'], gap: spacing['4'] },
  btnLogout: {
    borderRadius: radii.md, borderWidth: 1,
    paddingVertical: spacing['3'], alignItems: 'center',
    minHeight: 48, justifyContent: 'center',
  },
  btnLogoutInner: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
  btnLogoutText: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
});
