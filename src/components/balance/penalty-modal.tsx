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
import { AlertTriangle } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type PenaltyModalProps = Readonly<{
  visible: boolean;
  childName: string;
  onClose: () => void;
  onApply: (amount: number, description: string) => Promise<{ error: string | null }>;
}>;

export function PenaltyModal({ visible, childName, onClose, onApply }: PenaltyModalProps) {
  const { colors } = useTheme();

  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setAmount('');
    setDescription('');
    setError(null);
    onClose();
  }

  async function handleApply() {
    setError(null);
    const v = Number.parseInt(amount, 10);
    if (!amount || Number.isNaN(v) || v <= 0) { setError('Informe um valor válido.'); return; }
    if (!description.trim()) { setError('Informe a descrição.'); return; }

    setSaving(true);
    const result = await onApply(v, description.trim());
    setSaving(false);

    if (result.error) { setError(result.error); return; }
    handleClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <View style={[styles.box, { backgroundColor: colors.bg.surface }]}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Penalização — {childName}</Text>

          <Text style={[styles.label, { color: colors.text.secondary }]}>Valor (pontos) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.bg.canvas, borderColor: colors.border.default, color: colors.text.primary }]}
            value={amount}
            onChangeText={setAmount}
            placeholder="Ex: 10"
            placeholderTextColor={colors.text.muted}
            keyboardType="number-pad"
            maxLength={5}
          />

          <Text style={[styles.label, { color: colors.text.secondary }]}>Motivo *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline, { backgroundColor: colors.bg.canvas, borderColor: colors.border.default, color: colors.text.primary }]}
            value={description}
            onChangeText={setDescription}
            placeholder="Descreva o motivo…"
            placeholderTextColor={colors.text.muted}
            multiline
            maxLength={200}
          />

          {error ? <Text style={[styles.error, { color: colors.semantic.error }]}>{error}</Text> : null}

          <View style={styles.buttons}>
            <Pressable style={[styles.btn, styles.btnCancel, { borderColor: colors.border.default }]} onPress={handleClose}>
              <Text style={[styles.btnCancelText, { color: colors.text.secondary }]}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnConfirm, { backgroundColor: colors.semantic.error }, saving && styles.btnDisabled]}
              onPress={handleApply}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color={colors.text.inverse} />
                : <Text style={[styles.btnConfirmText, { color: colors.text.inverse }]}>Penalizar</Text>}
            </Pressable>
          </View>
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
        <Text style={[styles.triggerText, { color: colors.semantic.error }]}>Aplicar penalização</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  box: {
    borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl,
    padding: spacing['6'], paddingBottom: spacing['12'], gap: spacing['3'],
  },
  title: { fontSize: typography.size.lg, fontFamily: typography.family.bold },
  label: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
  input: {
    borderRadius: radii.md, borderWidth: 1,
    paddingHorizontal: spacing['3'], paddingVertical: spacing['3'],
    fontSize: typography.size.md, minHeight: 48,
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  error: { fontSize: typography.size.xs },
  buttons: { flexDirection: 'row', gap: spacing['3'] },
  btn: { flex: 1, borderRadius: radii.lg, paddingVertical: spacing['3'], alignItems: 'center', minHeight: 48 },
  btnCancel: { borderWidth: 1 },
  btnCancelText: { fontFamily: typography.family.semibold },
  btnConfirm: {},
  btnConfirmText: { fontFamily: typography.family.bold, fontSize: typography.size.md },
  btnDisabled: { opacity: 0.5 },
  triggerBtn: {
    borderRadius: radii.lg, paddingVertical: spacing['3'],
    alignItems: 'center', marginBottom: spacing['5'], minHeight: 44, justifyContent: 'center',
  },
  triggerInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  triggerText: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
});
