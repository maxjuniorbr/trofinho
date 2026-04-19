import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, User } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InlineMessage } from '@/components/ui/inline-message';
import { useUpdateUserName } from '@/hooks/queries/use-profile';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { UserProfile } from '@lib/auth';
import { localizeSupabaseError } from '@lib/api-error';

type PersonalDataSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  profile: UserProfile | null;
  email: string;
  onNameUpdated: (name: string) => void;
}>;

export function PersonalDataSheet({
  visible,
  onClose,
  profile,
  email,
  onNameUpdated,
}: PersonalDataSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const updateNameMutation = useUpdateUserName();

  const [name, setName] = useState(profile?.nome ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  // Sync name when profile changes or sheet opens
  useEffect(() => {
    if (visible) {
      setName(profile?.nome ?? '');
      setValidationError(null);
      setSuccess(false);
      clearCloseTimer();
      updateNameMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = useCallback(() => {
    clearCloseTimer();
    setValidationError(null);
    setSuccess(false);
    updateNameMutation.reset();
    onClose();
  }, [updateNameMutation, onClose, clearCloseTimer]);

  const handleSave = useCallback(() => {
    setValidationError(null);
    updateNameMutation.reset();
    const trimmed = name.trim();
    if (!trimmed) {
      setValidationError('Informe seu nome.');
      return;
    }
    updateNameMutation.mutate(trimmed, {
      onSuccess: () => {
        onNameUpdated(trimmed);
        setSuccess(true);
        clearCloseTimer();
        closeTimerRef.current = setTimeout(handleClose, 1200);
      },
    });
  }, [name, updateNameMutation, onNameUpdated, handleClose, clearCloseTimer]);

  const errorMessage =
    validationError ??
    (updateNameMutation.error ? localizeSupabaseError(updateNameMutation.error.message) : null);

  const canSubmit = name.trim().length > 0 && name.trim() !== (profile?.nome ?? '');

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      sheetStyle={styles.sheet}
      closeLabel="Fechar dados pessoais"
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
          <User size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Dados pessoais</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            Altere seu nome de exibição
          </Text>
        </View>
      </View>

      {success ? (
        <View style={styles.successContainer}>
          <View style={[styles.successIcon, { backgroundColor: colors.semantic.successBg }]}>
            <Check size={28} color={colors.semantic.success} strokeWidth={2.4} />
          </View>
          <Text style={[styles.successTitle, { color: colors.text.primary }]}>
            Nome atualizado!
          </Text>
          <Text style={[styles.successDesc, { color: colors.text.secondary }]}>
            Seu nome de exibição foi alterado.
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

          <Input
            label="Nome completo"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setValidationError(null);
              updateNameMutation.reset();
            }}
            placeholder="Seu nome"
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={60}
            accessibilityLabel="Nome completo"
            noMarginBottom
          />

          <Input
            label="E-mail"
            value={email}
            editable={false}
            accessibilityLabel="E-mail (não editável)"
            noMarginBottom
          />

          <Button
            label="Salvar alterações"
            loadingLabel="Salvando…"
            variant="primary"
            loading={updateNameMutation.isPending}
            onPress={handleSave}
            disabled={!canSubmit || updateNameMutation.isPending}
            accessibilityLabel="Salvar alterações"
          />
        </ScrollView>
      )}
    </BottomSheetModal>
  );
}

// ── Styles ───────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sheet: {
      borderCurve: 'continuous',
      maxHeight: '80%',
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
    successContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['10'],
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
      fontFamily: typography.family.bold,
      fontSize: typography.size.xl,
    },
    successDesc: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.sm,
      textAlign: 'center',
    },
  });
}
