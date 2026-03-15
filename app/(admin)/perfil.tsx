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
import { AvatarSection } from '@/components/profile/avatar-section';
import { PersonalDataCard } from '@/components/profile/personal-data-card';
import { PasswordCard } from '@/components/profile/password-card';
import { ThemeCard } from '@/components/profile/theme-card';
import {
  NotificationCard,
  normalizeNotificationPreferences,
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/components/profile/notification-card';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { supabase } from '@lib/supabase';
import { deviceStorage } from '@lib/device-storage';
import { getProfile, signOut, type UserProfile } from '@lib/auth';

const NOTIFICATION_PREFERENCES_KEY = 'notification_prefs';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>(
    DEFAULT_NOTIFICATION_PREFERENCES,
  );
  const [loggingOut, setLoggingOut] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function load() {
        setLoading(true);
        try {
          const [p, { data: authData, error: authError }, rawPrefs] = await Promise.all([
            getProfile(),
            supabase.auth.getUser(),
            deviceStorage.getItem(NOTIFICATION_PREFERENCES_KEY),
          ]);

          if (!active) return;

          if (authError || !authData.user) {
            router.replace('/(auth)/login');
            return;
          }

          setProfile(p);
          setEmail(authData.user.email ?? '');
          setAvatarUri(
            (authData.user.user_metadata?.avatar_url as string | undefined) ?? null,
          );
          setNotificationPreferences(normalizeNotificationPreferences(rawPrefs));
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
          onPreferencesChange={setNotificationPreferences}
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
