import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTaskEditState } from '@lib/tasks';
import { setNavigationFeedback } from '@lib/navigation-feedback';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { TaskFormFields } from '@/components/tasks/task-form-fields';
import { useTaskDetail, useUpdateTask } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export default function EditTaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const { data: task, isLoading, error, refetch } = useTaskDetail(id);
  const updateTaskMutation = useUpdateTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const editState = useMemo(
    () => (task ? getTaskEditState(task) : null),
    [task],
  );

  // Populate form fields when task data first loads
  useEffect(() => {
    if (task && !initialized) {
      setTitle(task.titulo);
      setDescription(task.descricao ?? '');
      setPoints(String(task.pontos));
      setInitialized(true);
    }
  }, [task, initialized]);

  // Redirect if task is not editable
  useEffect(() => {
    if (isLoading || !task || !editState || editState.canEdit) {
      return;
    }

    router.dismissTo({
      pathname: '/(admin)/tasks/[id]',
      params: { id: task.id },
    });
  }, [editState, isLoading, router, task]);

  const handleSave = () => {
    if (!task || !editState) return;

    setFormError(null);

    if (!title.trim()) {
      setFormError('Informe o título da tarefa.');
      return;
    }

    const parsedPoints = Number.parseInt(points, 10);

    if (Number.isNaN(parsedPoints) || parsedPoints <= 0) {
      setFormError('Pontos deve ser um número maior que zero.');
      return;
    }

    if (!editState.canEdit) {
      setFormError(editState.errorMessage);
      return;
    }

    updateTaskMutation.mutate({
      taskId: task.id,
      input: {
        titulo: title.trim(),
        descricao: description.trim() || null,
        pontos: editState.canEditPoints ? parsedPoints : task.pontos,
        exige_evidencia: task.exige_evidencia,
      },
    }, {
      onSuccess: () => {
        setNavigationFeedback('admin-task-detail', 'Tarefa atualizada com sucesso.');
        router.dismissTo({
          pathname: '/(admin)/tasks/[id]',
          params: { id: task.id },
        });
      },
      onError: (err) => {
        setFormError(err.message);
      },
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !task || !editState) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Editar Tarefa" onBack={() => router.back()} backLabel="Detalhes" />
        <View style={styles.center}>
          <EmptyState error={error?.message ?? 'Tarefa não encontrada.'} onRetry={() => refetch()} />
        </View>
      </View>
    );
  }

  if (!editState.canEdit) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  return (
    <StickyFooterScreen
      title="Editar Tarefa"
      onBack={() => router.back()}
      backLabel="Detalhes"
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={(
        <FormFooter message={formError} compact includeSafeBottom={false}>
          <Button
            label="Salvar alterações"
            loadingLabel="Salvando…"
            onPress={handleSave}
            loading={updateTaskMutation.isPending}
            accessibilityLabel="Salvar alterações da tarefa"
          />
        </FormFooter>
      )}
    >
      <StatusBar style={colors.statusBar} />
      {editState.infoMessage ? (
        <InlineMessage message={editState.infoMessage} variant="info" />
      ) : null}

      <View style={[styles.assignedChildrenCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
        <Text style={[styles.assignedChildrenTitle, { color: colors.text.primary }]}>Campos bloqueados neste marco</Text>
        <Text style={[styles.assignedChildrenText, { color: colors.text.secondary }]}>
          Filhos atribuídos e frequência permanecem fixos para preservar o histórico e o escopo da tarefa.
        </Text>
      </View>

      <TaskFormFields
        title={title}
        description={description}
        points={points}
        frequency={task.frequencia}
        requiresEvidence={task.exige_evidencia}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onPointsChange={setPoints}
        onFrequencyChange={() => {}}
        onRequiresEvidenceChange={() => {}}
        autoFocusTitle
        frequencyEditable={false}
        pointsEditable={editState.canEditPoints}
      />
    </StickyFooterScreen>
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
    assignedChildrenCard: {
      borderWidth: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
    },
    assignedChildrenTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
    },
    assignedChildrenText: {
      fontSize: typography.size.sm,
      lineHeight: typography.lineHeight.md,
    },
  });
}
