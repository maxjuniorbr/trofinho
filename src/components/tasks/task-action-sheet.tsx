import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useMemo } from 'react';
import {
  Archive,
  ArchiveRestore,
  Eye,
  Pause,
  Pencil,
  Play,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export type TaskActionState = Readonly<{
  isArchived: boolean;
  isInactive: boolean;
  hasPendingReview: boolean;
  canEdit: boolean;
}>;

type TaskActionSheetProps = Readonly<{
  visible: boolean;
  taskTitle: string;
  state: TaskActionState;
  onClose: () => void;
  onEdit?: () => void;
  onReview?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}>;

type ActionItem = Readonly<{
  key: string;
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'danger';
}>;

export function TaskActionSheet({
  visible,
  taskTitle,
  state,
  onClose,
  onEdit,
  onReview,
  onPause,
  onResume,
  onArchive,
  onUnarchive,
}: TaskActionSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const actions: ActionItem[] = [];

  if (state.hasPendingReview && onReview) {
    actions.push({
      key: 'review',
      icon: Eye,
      label: 'Revisar entregas',
      onPress: () => {
        onClose();
        onReview();
      },
    });
  }

  if (state.canEdit && onEdit && !state.isArchived) {
    actions.push({
      key: 'edit',
      icon: Pencil,
      label: 'Editar tarefa',
      onPress: () => {
        onClose();
        onEdit();
      },
    });
  }

  if (!state.isArchived) {
    if (state.isInactive && onResume) {
      actions.push({
        key: 'resume',
        icon: Play,
        label: 'Retomar tarefa',
        onPress: () => {
          onClose();
          onResume();
        },
      });
    } else if (!state.isInactive && onPause) {
      actions.push({
        key: 'pause',
        icon: Pause,
        label: 'Pausar tarefa',
        onPress: () => {
          onClose();
          onPause();
        },
      });
    }
  }

  if (state.isArchived && onUnarchive) {
    actions.push({
      key: 'unarchive',
      icon: ArchiveRestore,
      label: 'Desarquivar',
      onPress: () => {
        onClose();
        onUnarchive();
      },
    });
  } else if (!state.isArchived && onArchive) {
    actions.push({
      key: 'archive',
      icon: Archive,
      label: 'Arquivar',
      onPress: () => {
        onClose();
        onArchive();
      },
      tone: 'danger',
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar menu"
      >
        <Pressable style={[styles.sheet, { backgroundColor: colors.bg.surface }]} onPress={() => { }}>
          <Text style={[styles.title, { color: colors.text.primary }]} numberOfLines={2}>
            {taskTitle}
          </Text>
          <View style={styles.actions}>
            {actions.map((action) => {
              const Icon = action.icon;
              const isDanger = action.tone === 'danger';
              const tint = isDanger ? colors.semantic.error : colors.text.primary;
              return (
                <Pressable
                  key={action.key}
                  style={({ pressed }) => [
                    styles.actionRow,
                    { backgroundColor: pressed ? colors.bg.muted : 'transparent' },
                  ]}
                  onPress={action.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colors.bg.muted }]}>
                    <Icon size={18} color={tint} strokeWidth={2} />
                  </View>
                  <Text style={[styles.actionLabel, { color: tint }]}>{action.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingHorizontal: spacing['5'],
      paddingTop: spacing['5'],
      paddingBottom: spacing['10'],
      gap: spacing['3'],
    },
    title: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      marginBottom: spacing['1'],
    },
    actions: { gap: spacing['1'] },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['2'],
      borderRadius: radii.md,
      minHeight: 48,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      flex: 1,
    },
  });
}
