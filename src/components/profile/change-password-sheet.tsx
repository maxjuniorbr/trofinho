import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react-native';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { useUpdateUserPassword } from '@/hooks/queries/use-profile';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { localizeSupabaseError } from '@lib/api-error';

type ChangePasswordSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

const RULES = [
  { test: (pw: string) => pw.length >= 8, label: 'Pelo menos 8 caracteres' },
  { test: (pw: string) => /[A-Z]/.test(pw), label: 'Uma letra maiúscula' },
  { test: (pw: string) => /\d/.test(pw), label: 'Um número' },
] as const;

export function ChangePasswordSheet({ visible, onClose }: ChangePasswordSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updatePasswordMutation = useUpdateUserPassword();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const ruleResults = RULES.map((r) => ({ ok: r.test(next), label: r.label }));
  const passwordsMatch = next.length > 0 && next === confirm;
  const canSubmit = current.length > 0 && ruleResults.every((r) => r.ok) && passwordsMatch;

  const resetForm = useCallback(() => {
    clearCloseTimer();
    setCurrent('');
    setNext('');
    setConfirm('');
    setShowCurrent(false);
    setShowNext(false);
    setShowConfirm(false);
    setSuccess(false);
    updatePasswordMutation.reset();
  }, [updatePasswordMutation, clearCloseTimer]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    updatePasswordMutation.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          setSuccess(true);
          clearCloseTimer();
          closeTimerRef.current = setTimeout(handleClose, 1200);
        },
      },
    );
  }, [canSubmit, current, next, updatePasswordMutation, handleClose, clearCloseTimer]);

  const errorMessage = updatePasswordMutation.error
    ? localizeSupabaseError(updatePasswordMutation.error.message)
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        behavior="padding"
      >
        <View style={[styles.sheet, { backgroundColor: colors.bg.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
              <Lock size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
            </View>
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.text.primary }]}>Alterar senha</Text>
              <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                Informe a senha atual e escolha uma nova
              </Text>
            </View>
            <HeaderIconButton icon={X} onPress={handleClose} accessibilityLabel="Fechar" />
          </View>

          {success ? (
            <View style={styles.successContainer}>
              <View style={[styles.successIcon, { backgroundColor: colors.semantic.successBg }]}>
                <Check size={28} color={colors.semantic.success} strokeWidth={2.4} />
              </View>
              <Text style={[styles.successTitle, { color: colors.text.primary }]}>
                Senha alterada!
              </Text>
              <Text style={[styles.successDesc, { color: colors.text.secondary }]}>
                Use a nova senha no próximo login.
              </Text>
            </View>
          ) : (
            <ScrollView
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              {errorMessage ? <InlineMessage message={errorMessage} variant="error" /> : null}

              <PasswordField
                label="Senha atual"
                value={current}
                onChangeText={(v) => {
                  setCurrent(v);
                  updatePasswordMutation.reset();
                }}
                secureTextEntry={!showCurrent}
                onToggleVisibility={() => setShowCurrent((p) => !p)}
                colors={colors}
                styles={styles}
              />

              <PasswordField
                label="Nova senha"
                value={next}
                onChangeText={(v) => {
                  setNext(v);
                  updatePasswordMutation.reset();
                }}
                secureTextEntry={!showNext}
                onToggleVisibility={() => setShowNext((p) => !p)}
                colors={colors}
                styles={styles}
              />

              {/* Live strength rules */}
              <View style={styles.rulesContainer}>
                {ruleResults.map((r) => (
                  <View key={r.label} style={styles.ruleRow}>
                    <View
                      style={[
                        styles.ruleDot,
                        {
                          backgroundColor: r.ok ? colors.semantic.successBg : colors.bg.muted,
                        },
                      ]}
                    >
                      <Check
                        size={10}
                        color={r.ok ? colors.semantic.success : colors.text.muted}
                        strokeWidth={2.5}
                      />
                    </View>
                    <Text
                      style={[
                        styles.ruleLabel,
                        {
                          color: r.ok ? colors.semantic.success : colors.text.secondary,
                        },
                      ]}
                    >
                      {r.label}
                    </Text>
                  </View>
                ))}
              </View>

              <PasswordField
                label="Confirmar nova senha"
                value={confirm}
                onChangeText={(v) => {
                  setConfirm(v);
                  updatePasswordMutation.reset();
                }}
                secureTextEntry={!showConfirm}
                onToggleVisibility={() => setShowConfirm((p) => !p)}
                colors={colors}
                styles={styles}
              />

              {confirm.length > 0 && !passwordsMatch ? (
                <Text style={[styles.mismatchError, { color: colors.semantic.error }]}>
                  As senhas não coincidem.
                </Text>
              ) : null}

              <Button
                label="Salvar nova senha"
                loadingLabel="Salvando…"
                onPress={handleSubmit}
                loading={updatePasswordMutation.isPending}
                disabled={!canSubmit}
                accessibilityLabel="Salvar nova senha"
              />
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Password field with eye toggle ───────────────────────

type PasswordFieldProps = Readonly<{
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry: boolean;
  onToggleVisibility: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  styles: ReturnType<typeof makeStyles>;
}>;

const PasswordField = ({
  label,
  value,
  onChangeText,
  secureTextEntry,
  onToggleVisibility,
  colors,
  styles,
}: PasswordFieldProps) => {
  const EyeIcon = secureTextEntry ? Eye : EyeOff;

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.bg.elevated,
              borderColor: colors.border.default,
              color: colors.text.primary,
            },
          ]}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={72}
          accessibilityLabel={label}
          placeholderTextColor={colors.text.muted}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={onToggleVisibility}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={secureTextEntry ? 'Mostrar senha' : 'Ocultar senha'}
        >
          <EyeIcon size={16} color={colors.text.secondary} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing['3'],
      marginBottom: spacing['5'],
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: spacing['0.5'],
    },
    title: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
    },
    subtitle: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
    content: {
      gap: spacing['3'],
      paddingBottom: spacing['4'],
    },
    field: {
      gap: spacing['1'],
    },
    fieldLabel: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputWrapper: {
      position: 'relative',
    },
    input: {
      borderWidth: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['4'],
      paddingVertical: spacing['3'],
      paddingRight: spacing['12'],
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      minHeight: 48,
    },
    eyeButton: {
      position: 'absolute',
      right: spacing['3'],
      top: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      width: 36,
    },
    rulesContainer: {
      gap: spacing['1.5'],
    },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    ruleDot: {
      width: 16,
      height: 16,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ruleLabel: {
      fontSize: 11,
      fontFamily: typography.family.semibold,
    },
    mismatchError: {
      fontSize: 11,
      fontFamily: typography.family.bold,
    },
    successContainer: {
      paddingVertical: spacing['8'],
      alignItems: 'center',
      gap: spacing['3'],
    },
    successIcon: {
      width: 56,
      height: 56,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    successTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
    },
    successDesc: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
    },
  });
}
