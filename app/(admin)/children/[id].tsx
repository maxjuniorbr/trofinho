import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useChildDetail, useDeactivateChild, useReactivateChild } from '@/hooks/queries';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineMessage } from '@/components/ui/inline-message';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useTheme } from '@/context/theme-context';
import { radii, spacing } from '@/constants/theme';
import { getSafeBottomPadding } from '@lib/safe-area';

export default function AdminChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);

  const { data: child, isLoading, error, refetch } = useChildDetail(id);
  const deactivateMutation = useDeactivateChild();
  const reactivateMutation = useReactivateChild();

  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [feedbackVariant, setFeedbackVariant] = useState<'success' | 'warning' | 'error'>('success');
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
                setFeedbackMessage(err.message);
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
                setFeedbackMessage(err.message);
                setFeedbackVariant('error');
                setFeedbackKey((k) => k + 1);
              },
            });
          },
        },
      ],
    );
  }, [child, reactivateMutation]);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <EmptyState loading />
      </View>
    );
  }

  if (error || !child) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Dados do Filho" onBack={() => router.back()} backLabel="Filhos" />
        <View style={styles.center}>
          <EmptyState error={error?.message ?? 'Filho não encontrado.'} onRetry={refetch} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Dados do Filho" onBack={() => router.back()} backLabel="Filhos" />

      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        overScrollMode="never"
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: getSafeBottomPadding(insets, spacing['10']) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.identityCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
          <Avatar name={child.nome} size={88} imageUri={child.avatar_url} />
        </View>

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
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['6'],
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing['5'],
      paddingBottom: spacing['10'],
      gap: spacing['4'],
    },
    identityCard: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['5'],
    },
    deactivatedSection: {
      gap: spacing['3'],
    },
  });
}
