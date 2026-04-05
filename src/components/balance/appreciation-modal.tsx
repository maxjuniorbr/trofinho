import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import type { AppreciationPeriod } from '@lib/balances';
import { FormFooter } from '@/components/ui/form-footer';

const PERIODOS: { label: string; value: AppreciationPeriod }[] = [
  { label: 'Dia', value: 'diario' },
  { label: 'Semana', value: 'semanal' },
  { label: 'Mês', value: 'mensal' },
];

type AppreciationModalProps = Readonly<{
  visible: boolean;
  initialRate: number;
  initialPeriod: AppreciationPeriod;
  onClose: () => void;
  onSave: (rate: number, period: AppreciationPeriod) => Promise<{ error: string | null }>;
}>;

export function AppreciationModal({
  visible,
  initialRate,
  initialPeriod,
  onClose,
  onSave,
}: AppreciationModalProps) {
  const { colors } = useTheme();

  const [rate, setRate] = useState(String(initialRate));
  const [period, setPeriod] = useState<AppreciationPeriod>(initialPeriod);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    setError(null);
    const idx = Number.parseFloat(rate.replace(',', '.'));
    if (Number.isNaN(idx) || idx < 0 || idx > 100) {
      setError('Índice deve estar entre 0 e 100.');
      return;
    }

    setSaving(true);
    const result = await onSave(idx, period);
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    handleClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        behavior="padding"
      >
        <View style={[styles.box, { backgroundColor: colors.bg.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Configurar valorização</Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Índice (%) *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bg.canvas,
                borderColor: colors.border.default,
                color: colors.text.primary,
              },
            ]}
            value={rate}
            onChangeText={setRate}
            placeholder="Ex: 5"
            placeholderTextColor={colors.text.muted}
            keyboardType="decimal-pad"
            maxLength={6}
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Período</Text>
          <View style={styles.periodRow}>
            {PERIODOS.map((p) => (
              <Pressable
                key={p.value}
                style={[
                  styles.periodBtn,
                  { borderColor: colors.border.default },
                  period === p.value && [
                    styles.periodActive,
                    { backgroundColor: colors.accent.adminBg, borderColor: colors.accent.adminDim },
                  ],
                ]}
                onPress={() => setPeriod(p.value)}
              >
                <Text
                  style={[
                    styles.periodText,
                    { color: colors.text.secondary },
                    period === p.value && {
                      color: colors.accent.admin,
                      fontFamily: typography.family.bold,
                    },
                  ]}
                >
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <FormFooter message={error} compact>
            <View style={styles.buttons}>
              <Pressable
                style={[styles.btn, styles.btnCancel, { borderColor: colors.border.default }]}
                onPress={handleClose}
              >
                <Text style={[styles.btnCancelText, { color: colors.text.secondary }]}>
                  Cancelar
                </Text>
              </Pressable>
              <Pressable
                style={[
                  styles.btn,
                  styles.btnConfirm,
                  { backgroundColor: colors.accent.adminDim },
                  saving && styles.btnDisabled,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={[styles.btnConfirmText, { color: colors.text.inverse }]}>
                    Salvar
                  </Text>
                )}
              </Pressable>
            </View>
          </FormFooter>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  box: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing['6'],
    paddingBottom: spacing['12'],
    gap: spacing['3'],
  },
  title: { fontSize: typography.size.lg, fontFamily: typography.family.bold },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
  input: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['3'],
    fontSize: typography.size.md,
    minHeight: 48,
  },
  periodRow: { flexDirection: 'row', gap: spacing['2'] },
  periodBtn: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingVertical: spacing['2'],
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  periodActive: {},
  periodText: { fontSize: typography.size.sm, fontFamily: typography.family.medium },
  buttons: { flexDirection: 'row', gap: spacing['3'] },
  btn: {
    flex: 1,
    borderRadius: radii.lg,
    paddingVertical: spacing['3'],
    alignItems: 'center',
    minHeight: 48,
  },
  btnCancel: { borderWidth: 1 },
  btnCancelText: { fontFamily: typography.family.semibold },
  btnConfirm: {},
  btnConfirmText: { fontFamily: typography.family.bold, fontSize: typography.size.md },
  btnDisabled: { opacity: 0.5 },
});
