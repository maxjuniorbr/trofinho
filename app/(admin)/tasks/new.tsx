import { StyleSheet, Text, View, Pressable, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { TaskFormFields } from '@/components/tasks/task-form-fields';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { setNavigationFeedback } from '@lib/navigation-feedback';
import { useChildrenList, useCreateTask, useProfile } from '@/hooks/queries';
import type { TaskFrequencia } from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export default function NewTaskScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const { data: allChildren = [], isLoading: loadingChildren } = useChildrenList();
  const children = useMemo(() => allChildren.filter((c) => c.ativo !== false), [allChildren]);
  const { data: profile } = useProfile();
  const createTaskMutation = useCreateTask();

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [pontos, setPontos] = useState('');
  const [frequencia, setFrequencia] = useState<TaskFrequencia>('unica');
  const [exigeEvidencia, setExigeEvidencia] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const shouldShowError = Boolean(error);

  const toggleChild = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleCreate = () => {
    setError(null);
    if (!titulo.trim()) return setError('Informe o título da tarefa.');
    const pontosNum = Number.parseInt(pontos, 10);
    if (Number.isNaN(pontosNum) || pontosNum <= 0) return setError('Pontos deve ser um número maior que zero.');
    if (pontosNum > 99999) return setError('Pontos deve ser no máximo 99.999.');
    if (selected.size === 0) return setError('Selecione pelo menos um filho para atribuir a tarefa.');

    const filhoIds = Array.from(selected);
    createTaskMutation.mutate({
      input: {
        titulo: titulo.trim(), descricao: descricao.trim() || null, pontos: pontosNum,
        frequencia, exige_evidencia: exigeEvidencia, filhoIds,
      },
      opts: profile ? {
        familiaId: profile.familia_id,
        filhoIds,
      } : undefined,
    }, {
      onSuccess: () => {
        setNavigationFeedback('admin-task-list', 'Tarefa criada com sucesso.');
        router.dismissTo('/(admin)/tasks');
      },
      onError: (err) => {
        setError(err.message);
      },
    });
  };

  const renderChildrenList = () => {
    if (loadingChildren) return <ActivityIndicator color={colors.accent.admin} style={{ marginVertical: spacing['3'] }} />;
    if (children.length === 0) return <Text style={[styles.semFilhos, { color: colors.text.muted }]}>Nenhum filho cadastrado.</Text>;
    return children.map((child) => {
      const sel = selected.has(child.id);
      return (
        <Pressable
          key={child.id}
          style={[styles.filhoItem, { borderColor: sel ? colors.accent.adminDim : colors.border.default, backgroundColor: sel ? colors.accent.adminBg : colors.bg.surface }]}
          onPress={() => toggleChild(child.id)}
          accessibilityRole="button"
          accessibilityLabel={`Selecionar ${child.nome}`}
          accessibilityState={{ selected: sel }}
        >
          <Text style={[styles.filhoNome, { color: sel ? colors.accent.admin : colors.text.primary }]}>{child.nome}</Text>
          <Text style={[styles.filhoCheck, { color: sel ? colors.accent.admin : colors.text.muted }]}>{sel ? '✓' : '○'}</Text>
        </Pressable>
      );
    });
  };

  return (
    <StickyFooterScreen
      title="Nova Tarefa"
      onBack={() => router.back()}
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={(
        <FormFooter message={shouldShowError ? error : null} compact includeSafeBottom={false}>
          <Button
            label="Criar tarefa"
            loadingLabel="Criando…"
            onPress={handleCreate}
            loading={createTaskMutation.isPending}
            accessibilityLabel="Criar tarefa"
          />
        </FormFooter>
      )}
    >
      <StatusBar style={colors.statusBar} />
      <TaskFormFields
        title={titulo}
        description={descricao}
        points={pontos}
        frequency={frequencia}
        requiresEvidence={exigeEvidencia}
        onTitleChange={setTitulo}
        onDescriptionChange={setDescricao}
        onPointsChange={setPontos}
        onFrequencyChange={setFrequencia}
        onRequiresEvidenceChange={setExigeEvidencia}
        autoFocusTitle
      />

      <Text style={[styles.secaoTitulo, { color: colors.text.primary }]}>Atribuir para *</Text>
      <View style={styles.filhosList}>{renderChildrenList()}</View>
    </StickyFooterScreen>
  );
}

function makeStyles() {
  return StyleSheet.create({
    secaoTitulo: { fontSize: typography.size.md, fontFamily: typography.family.bold, marginTop: spacing['5'], marginBottom: spacing['3'] },
    filhosList: { gap: spacing['2'] },
    filhoItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: radii.md, padding: spacing['3'] },
    filhoNome: { fontSize: typography.size.md, fontFamily: typography.family.medium },
    filhoCheck: { fontSize: typography.size.lg },
    semFilhos: { fontSize: typography.size.sm, textAlign: 'center', marginVertical: spacing['4'] },
  });
}
