import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useCallback, useState } from 'react';
import { X } from 'lucide-react-native';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { useChildDetail, useDeactivateChild, useReactivateChild } from '@/hooks/queries';
import { localizeRpcError } from '@lib/api-error';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type ChildViewSheetProps = Readonly<{
  childId: string | null;
  onClose: () => void;
}>;

export function ChildViewSheet({ childId, onClose }: ChildViewSheetProps) {
  const { colors } = useTheme();
  const { data: child, isLoading } = useChildDetail(childId ?? undefined);
  const deactivateMutation = useDeactivateChild();
  const reactivateMutation = useReactivateChild();

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'warning' | 'error'>(
    'success',
  );
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedbackMessage, { resetKey: feedbackKey });

  const handleDeactivate = useCallback(() => {
    if (!child) return;
    Alert.alert(
      `Desativar ${child.nome}?`,
      `${child.nome} não poderá mais fazer login no app. Atribuições pendentes serão canceladas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => {
            deactivateMutation.mutate(child.id, {
              onSuccess: () => {
                setFeedbackMessage(`${child.nome} foi desativado.`);
                setFeedbackVariant('success');
                setFeedbackKey((k) => k + 1);
              },
              onError: (err) => {
                setFeedbackMessage(localizeRpcError(err.message));
                setFeedbackVariant('error');
                setFeedbackKey((k) => k + 1);
              },
            });
          },
        },
      ],
    );
  }, [child, deactivateMutation]);

  const handleReactivate = useCallback(() => {
    if (!child) return;
    Alert.alert(
      `Reativar ${child.nome}?`,
      `${child.nome} poderá fazer login novamente e retomar as atividades.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reativar',
          onPress: () => {
            reactivateMutation.mutate(child.id, {
              onSuccess: () => {
                setFeedbackMessage(`${child.nome} foi reativado.`);
                setFeedbackVariant('success');
                setFeedbackKey((k) => k + 1);
              },
              onError: (err) => {
                setFeedbackMessage(localizeRpcError(err.message));
                setFeedbackVariant('error');
                setFeedbackKey((k) => k + 1);
              },
            });
          },
        },
      ],
    );
  }, [child, reactivateMutation]);

  return (
    <Modal visible={childId !== null} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        behavior="padding"
      >
        <View style={[styles.sheet, { backgroundColor: colors.bg.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              {child?.nome ?? 'Dados do Filho'}
            </Text>
            <HeaderIconButton icon={X} onPress={onClose} accessibilityLabel="Fechar" />
          </View>

          {isLoading || !child ? (
            <View style={styles.loading}>
              <Text style={{ color: colors.text.muted }}>Carregando…</Text>
            </View>
          ) : (
            <ScrollView
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.content}
            >
              {visibleFeedback ? (
                <InlineMessage message={visibleFeedback} variant={feedbackVariant} />
              ) : null}

              {!child.ativo && (
                <View style={styles.deactivatedSection}>
                  <InlineMessage message="Este filho está desativado." variant="warning" />
                  <Button
                    variant="outline"
                    label="Reativar"
                    onPress={handleReactivate}
                    loading={reactivateMutation.isPending}
                    loadingLabel="Reativando…"
                    accessibilityLabel={`Reativar ${child.nome}`}
                  />
                </View>
              )}

              <Input
                label="Nome"
                value={child.nome}
                editable={false}
                accessibilityLabel="Nome do filho"
              />

              <Input
                label="E-mail"
                value={child.email ?? 'Sem conta vinculada'}
                editable={false}
                accessibilityLabel="E-mail do filho"
              />

              {child.ativo && (
                <Button
                  variant="danger"
                  label="Desativar"
                  onPress={handleDeactivate}
                  loading={deactivateMutation.isPending}
                  loadingLabel="Desativando…"
                  accessibilityLabel={`Desativar ${child.nome}`}
                />
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing['6'],
    paddingBottom: spacing['12'],
    maxHeight: '85%',
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
  loading: {
    paddingVertical: spacing['8'],
    alignItems: 'center',
  },
  content: {
    gap: spacing['2'],
    paddingBottom: spacing['4'],
  },
  deactivatedSection: {
    gap: spacing['2'],
    marginBottom: spacing['2'],
  },
});
