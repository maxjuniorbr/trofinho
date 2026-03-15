import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { supabase } from '@lib/supabase';
import { deviceStorage } from '@lib/device-storage';
import {
  getProfile,
  signOut,
  updateUserAvatar,
  updateUserName,
  updateUserPassword,
  type UserProfile,
} from '@lib/auth';

const NOTIF_PREFS_KEY = 'notification_prefs';

type NotifPrefs = {
  tarefas_pendentes: boolean;
  tarefa_concluida: boolean;
  resgate_solicitado: boolean;
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  tarefas_pendentes: true,
  tarefa_concluida: true,
  resgate_solicitado: true,
};

export default function PerfilScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [email, setEmail] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
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
            deviceStorage.getItem(NOTIF_PREFS_KEY),
          ]);

          if (!active) return;

          if (authError || !authData.user) {
            router.replace('/(auth)/login');
            return;
          }

          setProfile(p);
          setName(p?.nome ?? '');
          setEmail(authData.user.email ?? '');
          setAvatarUri(
            (authData.user.user_metadata?.avatar_url as string | undefined) ?? null,
          );

          if (rawPrefs) {
            try {
              const parsed = JSON.parse(rawPrefs) as Partial<NotifPrefs>;
              setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...parsed });
            } catch {
              // prefs inválidas — usa defaults
            }
          }

        } finally {
          if (active) setLoading(false);
        }
      }

      load();

      return () => { active = false; };
    }, []),
  );

  async function handlePickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    const uri = result.assets[0].uri;
    setAvatarError(null);
    setUploadingAvatar(true);
    const { url, error } = await updateUserAvatar(uri);
    setUploadingAvatar(false);

    if (error) {
      setAvatarError(error.message);
      return;
    }

    setAvatarUri(url);
  }

  async function handleSaveName() {
    setNameError(null);
    setNameSuccess(false);
    const trimmed = name.trim();
    if (!trimmed) return setNameError('Informe seu nome.');
    setSavingName(true);
    const { error } = await updateUserName(trimmed);
    setSavingName(false);
    if (error) { setNameError(error.message); return; }
    setProfile(prev => prev ? { ...prev, nome: trimmed } : null);
    setNameSuccess(true);
  }

  async function handleSavePassword() {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (newPassword.length < 6) return setPasswordError('A nova senha deve ter ao menos 6 caracteres.');
    if (newPassword !== confirmPassword) return setPasswordError('As senhas não coincidem.');
    setSavingPassword(true);
    const { error } = await updateUserPassword(newPassword);
    setSavingPassword(false);
    if (error) { setPasswordError(error.message); return; }
    setPasswordSuccess(true);
    setNewPassword('');
    setConfirmPassword('');
  }

  async function handleToggleNotif(key: keyof NotifPrefs, value: boolean) {
    const next = { ...notifPrefs, [key]: value };
    setNotifPrefs(next);
    await deviceStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(next));
  }

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await signOut();
    } catch {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.brand.vivid} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[{ flex: 1, backgroundColor: colors.bg.canvas }]} behavior="padding">
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Meu Perfil" onBack={() => router.back()} />

      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <Pressable
            onPress={handlePickAvatar}
            disabled={uploadingAvatar}
            style={styles.avatarWrapper}
            accessibilityRole="button"
            accessibilityLabel="Alterar foto de perfil"
          >
            <Avatar name={profile?.nome ?? 'A'} size={80} imageUri={avatarUri} />
            <View style={[styles.cameraBtn, { backgroundColor: colors.accent.admin }]}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={colors.text.inverse} />
                : <Text style={[styles.cameraBtnIcon, { color: colors.text.inverse }]}>📷</Text>
              }
            </View>
          </Pressable>

          <Text style={[styles.heroName, { color: colors.text.primary }]}>
            {profile?.nome ?? ''}
          </Text>
          {avatarError ? (
            <Text style={[styles.fieldError, { color: colors.semantic.error }]}>{avatarError}</Text>
          ) : null}
        </View>

        {/* ── Dados Pessoais ── */}
        <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Dados pessoais</Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Nome completo</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
            value={name}
            onChangeText={(v) => { setName(v); setNameSuccess(false); setNameError(null); }}
            placeholder="Seu nome"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>E-mail</Text>
          <View style={[styles.inputReadonly, { backgroundColor: colors.bg.muted, borderColor: colors.border.subtle }]}>
            <Text style={[styles.inputReadonlyText, { color: colors.text.muted }]}>{email}</Text>
          </View>

          {nameError ? (
            <Text style={[styles.fieldError, { color: colors.semantic.error }]}>{nameError}</Text>
          ) : null}
          {nameSuccess ? (
            <Text style={[styles.fieldSuccess, { color: colors.semantic.success }]}>Nome atualizado!</Text>
          ) : null}

          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent.admin, opacity: savingName ? 0.55 : 1, marginTop: spacing['1'] }]}
            onPress={handleSaveName}
            disabled={savingName}
          >
            {savingName
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={[styles.btnText, { color: colors.text.inverse }]}>Salvar alterações</Text>
            }
          </Pressable>
        </View>

        {/* ── Segurança ── */}
        <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Segurança</Text>
          <Text style={[styles.sectionSub, { color: colors.text.secondary }]}>Alterar senha</Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Nova senha</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
            value={newPassword}
            onChangeText={(v) => { setNewPassword(v); setPasswordSuccess(false); setPasswordError(null); }}
            placeholder="Mínimo 6 caracteres"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={72}
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Confirmar nova senha</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.elevated, borderColor: colors.border.default, color: colors.text.primary }]}
            value={confirmPassword}
            onChangeText={(v) => { setConfirmPassword(v); setPasswordSuccess(false); setPasswordError(null); }}
            placeholder="Repita a nova senha"
            placeholderTextColor={colors.text.muted}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={72}
          />

          {passwordError ? (
            <Text style={[styles.fieldError, { color: colors.semantic.error }]}>{passwordError}</Text>
          ) : null}
          {passwordSuccess ? (
            <Text style={[styles.fieldSuccess, { color: colors.semantic.success }]}>Senha alterada com sucesso!</Text>
          ) : null}

          <Pressable
            style={[styles.btn, { backgroundColor: colors.accent.admin, opacity: savingPassword ? 0.55 : 1, marginTop: spacing['1'] }]}
            onPress={handleSavePassword}
            disabled={savingPassword}
          >
            {savingPassword
              ? <ActivityIndicator color={colors.text.inverse} />
              : <Text style={[styles.btnText, { color: colors.text.inverse }]}>Confirmar nova senha</Text>
            }
          </Pressable>
        </View>

        {/* ── Notificações ── */}
        <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Notificações</Text>

          {(
            [
              { key: 'tarefas_pendentes', label: 'Tarefas pendentes' },
              { key: 'tarefa_concluida', label: 'Tarefa concluída pelo filho' },
              { key: 'resgate_solicitado', label: 'Resgate solicitado' },
            ] as const
          ).map(({ key, label }, idx, arr) => (
            <View
              key={key}
              style={[
                styles.toggleRow,
                idx < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
              ]}
            >
              <Text style={[styles.toggleLabel, { color: colors.text.primary }]}>{label}</Text>
              <Switch
                value={notifPrefs[key]}
                onValueChange={(v) => handleToggleNotif(key, v)}
                trackColor={{ false: colors.border.default, true: colors.accent.admin }}
                thumbColor={colors.text.inverse}
              />
            </View>
          ))}
        </View>

        {/* ── Sair ── */}
        <Pressable
          style={[styles.btnLogout, { borderColor: colors.semantic.error + '60', opacity: loggingOut ? 0.55 : 1 }]}
          onPress={handleSignOut}
          disabled={loggingOut}
          accessibilityRole="button"
          accessibilityLabel="Sair da conta"
        >
          {loggingOut
            ? <ActivityIndicator color={colors.semantic.error} />
            : <Text style={[styles.btnText, { color: colors.semantic.error }]}>Sair</Text>
          }
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles() {
  return StyleSheet.create({
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    scrollContent: { padding: spacing['5'], paddingBottom: spacing['12'], gap: spacing['4'] },

    avatarSection: { alignItems: 'center', paddingVertical: spacing['4'] },
    avatarWrapper: { position: 'relative', marginBottom: spacing['3'] },
    cameraBtn: {
      position: 'absolute', bottom: 0, right: 0,
      width: 26, height: 26, borderRadius: radii.full,
      alignItems: 'center', justifyContent: 'center',
    },
    cameraBtnIcon: { fontSize: 12 },
    heroName: { fontFamily: typography.family.bold, fontSize: typography.size.xl, textAlign: 'center' },

    card: {
      borderRadius: radii.lg, borderWidth: 1,
      padding: spacing['4'], gap: spacing['1'],
    },
    sectionTitle: { fontFamily: typography.family.bold, fontSize: typography.size.md, marginBottom: spacing['2'] },
    sectionSub: { fontFamily: typography.family.semibold, fontSize: typography.size.sm, marginBottom: spacing['2'] },

    label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold, marginTop: spacing['3'], marginBottom: spacing['1'] },
    input: { borderWidth: 1, borderRadius: radii.md, paddingHorizontal: spacing['4'], paddingVertical: spacing['3'], fontSize: typography.size.md },
    inputReadonly: {
      borderWidth: 1, borderRadius: radii.md,
      paddingHorizontal: spacing['4'], paddingVertical: spacing['3'],
      minHeight: 48, justifyContent: 'center',
    },
    inputReadonlyText: { fontSize: typography.size.md },

    fieldError: { fontSize: typography.size.sm, marginTop: spacing['2'] },
    fieldSuccess: { fontSize: typography.size.sm, marginTop: spacing['2'] },

    btn: {
      borderRadius: radii.md, paddingVertical: spacing['3'],
      alignItems: 'center', minHeight: 48, justifyContent: 'center',
      marginTop: spacing['3'],
    },
    btnText: { fontSize: typography.size.md, fontFamily: typography.family.semibold },

    toggleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing['3'],
    },
    toggleLabel: { fontSize: typography.size.md, fontFamily: typography.family.medium, flex: 1, paddingRight: spacing['3'] },

    btnLogout: {
      borderRadius: radii.md, borderWidth: 1,
      paddingVertical: spacing['3'], alignItems: 'center',
      minHeight: 48, justifyContent: 'center',
    },
  });
}
