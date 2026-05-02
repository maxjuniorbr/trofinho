import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useCallback, useState } from 'react';
import { Mail, User } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import {
  useChildDetail,
  useDeactivateChild,
  useReactivateChild,
  useAdminBalances,
} from '@/hooks/queries';
import { localizeRpcError } from '@lib/api-error';
import { buildChildDeactivateMessage } from '@lib/children';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import { useAppAlert } from '@/context/app-alert-context';
import { spacing, typography } from '@/constants/theme';

type ChildViewSheetProps = Readonly<{
  childId: string | null;
  onClose: () => void;
}>;

export function ChildViewSheet({ childId, onClose }: ChildViewSheetProps) {
  const { colors } = useTheme();
  const { showAlert } = useAppAlert();
  const { data: child, isLoading } = useChildDetail(childId ?? undefined);
  const deactivateMutation = useDeactivateChild();
  const reactivateMutation = useReactivateChild();
  const { data: balances = [] } = useAdminBalances();

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'warning' | 'error'>(
    'success',
  );
  const [feedbackKey, setFeedbackKey] = useState(0);
  const visibleFeedback = useTransientMessage(feedbackMessage, { resetKey: feedbackKey });

  const showFeedback = (message: string, variant: 'success' | 'error') => {
    setFeedbackMessage(message);
    setFeedbackVariant(variant);
    setFeedbackKey((k) => k + 1);
  };

  const executeDeactivate = useCallback(
    (childId: string, childName: string) => {
      deactivateMutation.mutate(childId, {
        onSuccess: () => showFeedback(`${childName} foi desativado.`, 'success'),
        onError: (err) => showFeedback(localizeRpcError(err.message), 'error'),
      });
    },
    [deactivateMutation],
  );

  const executeReactivate = useCallback(
    (childId: string, childName: string) => {
      reactivateMutation.mutate(childId, {
        onSuccess: () => showFeedback(`${childName} foi reativado.`, 'success'),
        onError: (err) => showFeedback(localizeRpcError(err.message), 'error'),
      });
    },
    [reactivateMutation],
  );

  const handleDeactivate = useCallback(() => {
    if (!child) return;
    const balance = balances.find((b) => b.filho_id === child.id);
    const totalBalance = balance ? balance.saldo_livre + balance.cofrinho : 0;
    const message = buildChildDeactivateMessage(child.nome, {
      pendingCount: 0,
      awaitingCount: 0,
      totalBalance,
    });
    showAlert({
      title: `Desativar ${child.nome}?`,
      message,
      actions: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desativar',
          style: 'destructive',
          onPress: () => executeDeactivate(child.id, child.nome),
        },
      ],
    });
  }, [child, balances, showAlert, executeDeactivate]);

  const handleReactivate = useCallback(() => {
    if (!child) return;
    showAlert({
      title: `Reativar ${child.nome}?`,
      message: `${child.nome} poderá fazer login novamente e retomar as atividades.`,
      actions: [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reativar',
          onPress: () => executeReactivate(child.id, child.nome),
        },
      ],
    });
  }, [child, showAlert, executeReactivate]);

  return (
    <BottomSheetModal
      visible={childId !== null}
      onClose={onClose}
      sheetStyle={styles.sheet}
      closeLabel="Fechar dados do filho"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>
          {child?.nome ?? 'Dados do Filho'}
        </Text>
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
            leadingIcon={User}
            accessibilityLabel="Nome do filho"
          />

          <Input
            label="E-mail"
            value={child.email ?? 'Sem conta vinculada'}
            editable={false}
            leadingIcon={Mail}
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
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: {
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
