import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { TaskFormFields } from '@/components/tasks/task-form-fields';
import { useChildrenList, useCreateTask, useProfile, useUpdateTask } from '@/hooks/queries';
import { ALL_DAYS, getTaskEditState, type TaskDetail, type TaskEditState } from '@lib/tasks';
import { localizeRpcError } from '@lib/api-error';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

type TaskFormSheetProps = Readonly<{
  visible: boolean;
  mode: 'create' | 'edit';
  task?: TaskDetail | null;
  onClose: () => void;
  onSuccess?: (message: string) => void;
}>;

export function TaskFormSheet({ visible, mode, task, onClose, onSuccess }: TaskFormSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: allChildren = [], isLoading: loadingChildren } = useChildrenList();
  const children = useMemo(() => allChildren.filter((c) => c.ativo !== false), [allChildren]);
  const { data: profile } = useProfile();
  const createMutation = useCreateTask();
  const updateMutation = useUpdateTask();
  const titleInputRef = useRef<TextInput>(null);

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState('');
  const [diasSemana, setDiasSemana] = useState<number>(ALL_DAYS);
  const [exigeEvidencia, setExigeEvidencia] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const isEdit = mode === 'edit';
  const editState: TaskEditState | null = useMemo(
    () => (isEdit && task ? getTaskEditState(task) : null),
    [isEdit, task],
  );

  const resetForm = useCallback(() => {
    setTitulo('');
    setDescricao('');
    setPontos('');
    setDiasSemana(ALL_DAYS);
    setExigeEvidencia(false);
    setSelected(new Set());
    setError(null);
    createMutation.reset();
    updateMutation.reset();
  }, [createMutation, updateMutation]);

  // Hydrate when opening for edit
  useEffect(() => {
    if (!visible) return;
    if (isEdit && task) {
      setTitulo(task.titulo);
      setDescricao(task.descricao ?? '');
      setPontos(String(task.pontos));
      setDiasSemana(task.dias_semana);
      setExigeEvidencia(task.exige_evidencia);
      setError(null);
    } else if (!isEdit) {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, isEdit, task?.id]);

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [resetForm, onClose]);

  const toggleChild = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const validate = (): {
    ok: boolean;
    pontosNum: number;
    filhoIds: string[];
  } => {
    setError(null);
    if (!titulo.trim()) {
      setError('Informe o título da tarefa.');
      return { ok: false, pontosNum: 0, filhoIds: [] };
    }
    const pontosNum = Number.parseInt(pontos, 10);
    if (Number.isNaN(pontosNum) || pontosNum <= 0) {
      setError('Pontos deve ser um número maior que zero.');
      return { ok: false, pontosNum: 0, filhoIds: [] };
    }
    if (pontosNum > 99999) {
      setError('Pontos deve ser no máximo 99.999.');
      return { ok: false, pontosNum, filhoIds: [] };
    }
    if (diasSemana <= 0) {
      setError('Selecione pelo menos um dia da semana.');
      return { ok: false, pontosNum, filhoIds: [] };
    }
    const filhoIds = Array.from(selected);
    if (!isEdit && filhoIds.length === 0) {
      setError('Selecione pelo menos um filho para atribuir a tarefa.');
      return { ok: false, pontosNum, filhoIds };
    }
    return { ok: true, pontosNum, filhoIds };
  };

  const handleCreate = ({ pontosNum, filhoIds }: { pontosNum: number; filhoIds: string[] }) => {
    createMutation.mutate(
      {
        input: {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          pontos: pontosNum,
          dias_semana: diasSemana,
          exige_evidencia: exigeEvidencia,
          filhoIds,
        },
        opts: profile ? { familiaId: profile.familia_id, filhoIds } : undefined,
      },
      {
        onSuccess: () => {
          onSuccess?.('Tarefa criada com sucesso.');
          handleClose();
        },
        onError: (err) => setError(localizeRpcError(err.message)),
      },
    );
  };

  const handleUpdate = ({ pontosNum }: { pontosNum: number }) => {
    if (!task || !editState) return;
    if (!editState.canEdit) {
      setError(editState.errorMessage);
      return;
    }
    updateMutation.mutate(
      {
        taskId: task.id,
        input: {
          titulo: titulo.trim(),
          descricao: descricao.trim() || null,
          pontos: editState.canEditPoints ? pontosNum : task.pontos,
          exige_evidencia: exigeEvidencia,
          dias_semana: diasSemana,
        },
      },
      {
        onSuccess: () => {
          onSuccess?.('Tarefa atualizada com sucesso.');
          handleClose();
        },
        onError: (err) => setError(localizeRpcError(err.message)),
      },
    );
  };

  const handleSubmit = () => {
    const result = validate();
    if (!result.ok) return;
    if (isEdit) handleUpdate(result);
    else handleCreate(result);
  };

  const focusInitialField = useCallback(() => {
    if (!isEdit) titleInputRef.current?.focus();
  }, [isEdit]);

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const title = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';
  const submitLabel = isEdit ? 'Salvar alterações' : 'Criar tarefa';

  const renderChildrenSection = () => {
    if (isEdit) return null;
    if (loadingChildren) {
      return (
        <ActivityIndicator color={colors.accent.admin} style={{ marginVertical: spacing['3'] }} />
      );
    }
    if (children.length === 0) {
      return (
        <Text style={[styles.semFilhos, { color: colors.text.muted }]}>
          Nenhum filho cadastrado.
        </Text>
      );
    }
    return (
      <View style={styles.filhosList}>
        {children.map((child) => {
          const sel = selected.has(child.id);
          return (
            <Pressable
              key={child.id}
              style={[
                styles.filhoItem,
                {
                  borderColor: sel ? colors.accent.adminDim : colors.border.default,
                  backgroundColor: sel ? colors.accent.adminBg : colors.bg.surface,
                },
              ]}
              onPress={() => toggleChild(child.id)}
              accessibilityRole="checkbox"
              accessibilityLabel={`Selecionar ${child.nome}`}
              accessibilityState={{ checked: sel }}
            >
              <Text
                style={[
                  styles.filhoNome,
                  { color: sel ? colors.accent.admin : colors.text.primary },
                ]}
              >
                {child.nome}
              </Text>
              <Text
                style={[
                  styles.filhoCheck,
                  { color: sel ? colors.accent.admin : colors.text.muted },
                ]}
              >
                {sel ? '✓' : '○'}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={handleClose}
      onShow={focusInitialField}
      sheetStyle={styles.sheet}
      closeLabel={isEdit ? 'Fechar edição de tarefa' : 'Fechar nova tarefa'}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
      </View>

      <ScrollView
        overScrollMode="never"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {error ? <InlineMessage message={error} variant="error" /> : null}

        {isEdit && editState?.infoMessage ? (
          <InlineMessage message={editState.infoMessage} variant="info" />
        ) : null}

        <TaskFormFields
          title={titulo}
          description={descricao}
          points={pontos}
          diasSemana={diasSemana}
          requiresEvidence={exigeEvidencia}
          onTitleChange={setTitulo}
          onDescriptionChange={setDescricao}
          onPointsChange={setPontos}
          onDiasSemanaChange={setDiasSemana}
          onRequiresEvidenceChange={setExigeEvidencia}
          titleInputRef={titleInputRef}
          autoFocusTitle={!isEdit}
          weekdaysEditable={!isEdit || (editState?.canEdit ?? true)}
          pointsEditable={!isEdit || (editState?.canEditPoints ?? true)}
        />

        {isEdit ? null : (
          <>
            <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>
              Atribuir para *
            </Text>
            {renderChildrenSection()}
          </>
        )}

        <Button
          label={submitLabel}
          loadingLabel={isEdit ? 'Salvando…' : 'Criando…'}
          onPress={handleSubmit}
          loading={isSaving}
          disabled={isEdit && editState ? !editState.canEdit : false}
          accessibilityLabel={submitLabel}
        />
      </ScrollView>
    </BottomSheetModal>
  );
}

function makeStyles(colors: ThemeColors) {
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
      gap: spacing['4'],
      paddingBottom: spacing['4'],
    },
    secaoTitulo: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      marginTop: spacing['2'],
    },
    filhosList: { gap: spacing['2'] },
    filhoItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderRadius: radii.md,
      padding: spacing['3'],
    },
    filhoNome: { fontSize: typography.size.md, fontFamily: typography.family.medium },
    filhoCheck: { fontSize: typography.size.lg },
    semFilhos: {
      fontSize: typography.size.sm,
      textAlign: 'center',
      marginVertical: spacing['4'],
    },
  });
}
