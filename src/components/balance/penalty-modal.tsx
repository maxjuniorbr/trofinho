import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { FormFooter } from '@/components/ui/form-footer';

type PenaltyModalProps = Readonly<{
  visible: boolean;
  childName: string;
  onClose: () => void;
  onApply: (
    amount: number,
    description: string,
  ) => Promise<{ error: string | null; warning?: string | null }>;
}>;

export function PenaltyModal({ visible, childName, onClose, onApply }: PenaltyModalProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const handleClose = () => {
    setAmount('');
    setDescription('');
    setError(null);
    setWarning(null);
    onClose();
  };

  const handleApply = () => {
    setError(null);
    setWarning(null);
    const v = Number.parseInt(amount, 10);
    if (!amount || Number.isNaN(v) || v <= 0) {
      setError('Informe um valor válido.');
      return;
    }
    if (!description.trim()) {
      setError('Informe a descrição.');
      return;
    }

    Alert.alert(
      'Aplicar penalidade?',
      `Descontar ${v} ponto${v === 1 ? '' : 's'} de ${childName}?`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Aplicar',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            const result = await onApply(v, description.trim());
            setSaving(false);

            if (result.error) {
              setError(result.error);
              return;
            }
            if (result.warning) {
              setWarning(result.warning);
              return;
            }
            handleClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        behavior="padding"
      >
        <View style={[styles.box, { backgroundColor: colors.bg.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Penalização — {childName}
          </Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Valor (pontos) *</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bg.canvas,
                borderColor: colors.border.default,
                color: colors.text.primary,
              },
            ]}
            value={amount}
            onChangeText={setAmount}
            placeholder="Ex: 10"
            placeholderTextColor={colors.text.muted}
            keyboardType="number-pad"
            maxLength={5}
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Motivo *</Text>
          <TextInput
            style={[
              styles.input,
              styles.inputMultiline,
              {
                backgroundColor: colors.bg.canvas,
                borderColor: colors.border.default,
                color: colors.text.primary,
              },
            ]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o motivo…"
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={200}
          />
          <FormFooter message={error ?? warning} variant={warning ? 'warning' : 'error'} compact>
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
                  { backgroundColor: colors.semantic.error },
                  saving && styles.btnDisabled,
                ]}
                onPress={handleApply}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={colors.text.inverse} />
                ) : (
                  <Text style={[styles.btnConfirmText, { color: colors.text.inverse }]}>
                    Penalizar
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

export function PenaltyButton({ onPress }: Readonly<{ onPress: () => void }>) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.triggerBtn, { backgroundColor: colors.semantic.errorBg }]}
      onPress={onPress}
    >
      <View style={styles.triggerInner}>
        <AlertTriangle size={14} color={colors.semantic.error} strokeWidth={2} />
        <Text style={[styles.triggerText, { color: colors.semantic.error }]}>
          Aplicar penalização
        </Text>
      </View>
    </Pressable>
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
  inputMultiline: { height: 80, textAlignVertical: 'top' },
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
  triggerBtn: {
    borderRadius: radii.lg,
    paddingVertical: spacing['3'],
    alignItems: 'center',
    marginBottom: spacing['5'],
    minHeight: 44,
    justifyContent: 'center',
  },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'] },
  triggerText: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
});
