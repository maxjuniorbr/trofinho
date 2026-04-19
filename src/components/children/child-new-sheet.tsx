import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useMemo, useState } from 'react';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { isValidEmail, MAX_EMAIL_LENGTH } from '@lib/validation';
import { useRegisterChild } from '@/hooks/queries/use-register-child';
import { localizeSupabaseError } from '@lib/api-error';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

const AVATARS = ['🧒🏻', '👦🏽', '👧🏻', '🧒🏽', '👦🏻', '👧🏽'] as const;

type ChildNewSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
}>;

export function ChildNewSheet({ visible, onClose }: ChildNewSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const registerMutation = useRegisterChild();

  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [tempPassword, setTempPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setAvatar(AVATARS[0]);
    setName('');
    setEmail('');
    setTempPassword('');
    setConfirmPassword('');
    setValidationError(null);
    registerMutation.reset();
  }, [registerMutation]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const handleRegister = useCallback(() => {
    setValidationError(null);
    registerMutation.reset();
    const emailValue = email.trim().toLowerCase();
    if (!name.trim()) {
      setValidationError('Informe o nome do filho.');
      return;
    }
    if (!isValidEmail(emailValue)) {
      setValidationError('E-mail inválido.');
      return;
    }
    if (tempPassword.length < 8) {
      setValidationError('A senha temporária deve ter pelo menos 8 caracteres.');
      return;
    }
    if (tempPassword !== confirmPassword) {
      setValidationError('As senhas não coincidem.');
      return;
    }
    registerMutation.mutate(
      { name: name.trim(), email: emailValue, tempPassword, avatar },
      { onSuccess: handleClose },
    );
  }, [name, email, tempPassword, confirmPassword, registerMutation, avatar, handleClose]);

  const errorMessage =
    validationError ??
    (registerMutation.error ? localizeSupabaseError(registerMutation.error.message) : null);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      sheetStyle={styles.sheet}
      closeLabel="Fechar cadastro de filho"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Novo Filho</Text>
      </View>

      <ScrollView
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {errorMessage ? <InlineMessage message={errorMessage} variant="error" /> : null}

        <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
          Escolha um avatar
        </Text>
        <View style={styles.avatarGrid}>
          {AVATARS.map((emoji) => (
            <Pressable
              key={emoji}
              style={[
                styles.avatarCell,
                {
                  backgroundColor: avatar === emoji ? colors.accent.adminBg : colors.bg.muted,
                  borderColor: avatar === emoji ? colors.accent.admin : 'transparent',
                },
              ]}
              onPress={() => setAvatar(emoji)}
              accessibilityRole="radio"
              accessibilityState={{ selected: avatar === emoji }}
              accessibilityLabel={`Avatar ${emoji}`}
            >
              <Text style={styles.avatarEmoji}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <Input
          label="Nome *"
          value={name}
          onChangeText={setName}
          placeholder="Nome do filho"
          maxLength={60}
          autoCapitalize="words"
          autoCorrect={false}
          accessibilityLabel="Nome do filho"
          noMarginBottom
        />

        <Input
          label="E-mail *"
          value={email}
          onChangeText={setEmail}
          placeholder="seu@email.com"
          maxLength={MAX_EMAIL_LENGTH}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          accessibilityLabel="E-mail do filho"
          noMarginBottom
        />

        <Input
          label="Senha temporária *"
          value={tempPassword}
          onChangeText={setTempPassword}
          placeholder="Mínimo 8 caracteres"
          maxLength={40}
          autoCapitalize="none"
          secureTextEntry
          autoCorrect={false}
          accessibilityLabel="Senha temporária"
          noMarginBottom
        />

        <Input
          label="Confirmar senha *"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repita a senha"
          maxLength={40}
          autoCapitalize="none"
          secureTextEntry
          autoCorrect={false}
          accessibilityLabel="Confirmar senha"
          noMarginBottom
        />

        <View style={styles.infoBox}>
          <Text style={[styles.infoText, { color: colors.text.secondary }]}>
            O sistema criará uma conta para o filho. Compartilhe o e-mail e senha temporária para o
            primeiro acesso.
          </Text>
        </View>

        <Button
          label="Cadastrar filho"
          loadingLabel="Cadastrando…"
          onPress={handleRegister}
          loading={registerMutation.isPending}
          accessibilityLabel="Cadastrar filho"
        />
      </ScrollView>
    </BottomSheetModal>
  );
}

function makeStyles(
  colors: ReturnType<typeof import('@/context/theme-context').useTheme>['colors'],
) {
  return StyleSheet.create({
    sheet: {
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['4'],
    },
    title: {
      fontSize: typography.size.lg,
      fontFamily: typography.family.bold,
    },
    content: {
      gap: spacing['3'],
      paddingBottom: spacing['4'],
    },
    sectionLabel: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
    },
    avatarGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing['2'],
    },
    avatarCell: {
      width: 48,
      height: 48,
      borderRadius: radii.lg,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarEmoji: {
      fontSize: 28,
    },
    infoBox: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border.subtle,
      backgroundColor: colors.accent.adminBg,
      padding: spacing['3'],
    },
    infoText: {
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.sm,
    },
  });
}
