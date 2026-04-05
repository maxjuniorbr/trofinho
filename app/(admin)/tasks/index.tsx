import { StyleSheet, Text, View, Pressable, RefreshControl } from 'react-native';
import { SegmentedBar, type SegmentOption } from '@/components/ui/segmented-bar';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Plus, RefreshCw } from 'lucide-react-native';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import { InlineMessage } from '@/components/ui/inline-message';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { ListFooter } from '@/components/ui/list-footer';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { consumeNavigationFeedback, type NavigationFeedback } from '@lib/navigation-feedback';
import { useAdminTasks } from '@/hooks/queries';
import { sortAdminTasks, type AdminTaskSort, type TaskListItem } from '@lib/tasks';
import { formatDate } from '@lib/utils';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, shadows, spacing, typography } from '@/constants/theme';

const SORT_OPTIONS: SegmentOption<AdminTaskSort>[] = [
  { key: 'action_first', label: 'Por ação', accessibilityLabel: 'Ordenar por ação pendente' },
  {
    key: 'newest_first',
    label: 'Mais recentes',
    accessibilityLabel: 'Ordenar por data de criação',
  },
];

type AdminTaskCardProps = Readonly<{
  item: TaskListItem;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}>;

function AdminTaskCard({ item, colors, styles, onPress }: AdminTaskCardProps) {
  const total = item.atribuicoes.length;
  const pendentes = item.atribuicoes.filter((a) => a.status === 'pendente').length;
  const aguardando = item.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length;
  const aprovadas = item.atribuicoes.filter((a) => a.status === 'aprovada').length;

  const isInactive = item.ativo === false;

  return (
    <Pressable
      style={({ pressed }) => {
        const baseOpacity = isInactive ? 0.5 : 1;
        return [
          styles.card,
          shadows.card,
          {
            backgroundColor: colors.bg.surface,
            borderColor: colors.border.subtle,
            opacity: pressed ? 0.9 : baseOpacity,
          },
        ];
      }}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Ver detalhes da tarefa ${item.titulo}`}
    >
      <View style={styles.cardTopo}>
        <View style={styles.cardTituloRow}>
          <Text style={[styles.cardTitulo, { color: colors.text.primary }]} numberOfLines={2}>
            {item.titulo}
          </Text>
          {isInactive && (
            <View style={[styles.inactiveBadge, { backgroundColor: colors.semantic.warningBg }]}>
              <Text style={[styles.inactiveBadgeText, { color: colors.semantic.warningText }]}>
                Desativada
              </Text>
            </View>
          )}
        </View>
        <View style={[styles.pontosTag, { backgroundColor: colors.brand.subtle }]}>
          <Text style={[styles.pontosTexto, { color: colors.brand.dim }]}>{item.pontos} pts</Text>
        </View>
      </View>
      <View style={styles.freqRow}>
        {item.frequencia === 'diaria' ? (
          <RefreshCw size={12} color={colors.text.muted} strokeWidth={2} />
        ) : null}
        <Text style={[styles.cardPrazo, { color: colors.text.muted }]}>
          {item.frequencia === 'diaria' ? 'Diária' : 'Única'}
          {' · '}
          {formatDate(item.created_at)}
        </Text>
      </View>
      <View style={styles.cardStats}>
        {total === 0 ? (
          <Text style={[styles.statTexto, { color: colors.text.muted }]}>Sem atribuições</Text>
        ) : (
          <>
            {pendentes > 0 ? (
              <Badge label={`${pendentes} pendente${pendentes > 1 ? 's' : ''}`} variant="warning" />
            ) : null}
            {aguardando > 0 ? <Badge label={`${aguardando} validar`} variant="info" /> : null}
            {aprovadas > 0 ? (
              <Badge label={`${aprovadas} aprovada${aprovadas > 1 ? 's' : ''}`} variant="success" />
            ) : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

export default function AdminTasksScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useAdminTasks();
  const tasks = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);
  const [sort, setSort] = useState<AdminTaskSort>('action_first');
  const [successFeedback, setSuccessFeedback] = useState<NavigationFeedback | null>(null);

  const visibleSuccessMessage = useTransientMessage(successFeedback?.message ?? null, {
    resetKey: successFeedback?.id,
  });

  const sortedTasks = useMemo(() => sortAdminTasks(tasks, sort), [tasks, sort]);
  const shouldShowEmptyState = isLoading || Boolean(error) || tasks.length === 0;

  useFocusEffect(
    useCallback(() => {
      const feedback = consumeNavigationFeedback('admin-task-list');
      if (feedback) setSuccessFeedback(feedback);
    }, []),
  );

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Tarefas"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => router.push('/(admin)/tasks/new')}
            accessibilityLabel="Criar tarefa"
          />
        }
      />

      <SegmentedBar options={SORT_OPTIONS} value={sort} onChange={setSort} role="admin" />

      {visibleSuccessMessage ? (
        <View style={styles.feedbackWrapper}>
          <InlineMessage message={visibleSuccessMessage} variant="success" />
        </View>
      ) : null}

      {shouldShowEmptyState ? (
        <EmptyState
          loading={isLoading}
          error={error?.message ?? null}
          empty={tasks.length === 0}
          emptyMessage={'Nenhuma tarefa criada ainda.\nToque em "+" para criar a primeira tarefa.'}
          onRetry={() => refetch()}
        />
      ) : (
        <FlashList
          data={sortedTasks}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={() => refetch()}
              tintColor={colors.brand.vivid}
            />
          }
          onEndReached={() => {
            if (hasNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
          ListFooterComponent={<ListFooter loading={isFetchingNextPage} />}
          renderItem={({ item }) => (
            <AdminTaskCard
              item={item}
              colors={colors}
              styles={styles}
              onPress={() => router.push(`/(admin)/tasks/${item.id}` as never)}
            />
          )}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    feedbackWrapper: { paddingHorizontal: spacing['4'], paddingTop: spacing['4'] },
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['4'],
      marginBottom: spacing['3'],
    },
    cardTopo: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing['2'] },
    cardTituloRow: { flex: 1, marginRight: spacing['2'], gap: spacing['1'] },
    cardTitulo: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    inactiveBadge: {
      borderRadius: radii.sm,
      paddingVertical: spacing['0.5'],
      paddingHorizontal: spacing['2'],
      alignSelf: 'flex-start',
    },
    inactiveBadgeText: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
    pontosTag: {
      borderRadius: radii.full,
      paddingHorizontal: spacing['2'],
      paddingVertical: spacing['1'],
    },
    pontosTexto: { fontSize: typography.size.xs, fontFamily: typography.family.bold },
    freqRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginBottom: spacing['2'],
    },
    cardPrazo: { fontSize: typography.size.xs },
    cardStats: { flexDirection: 'row', gap: spacing['2'], flexWrap: 'wrap' },
    statTexto: { fontSize: typography.size.xs },
  });
}
