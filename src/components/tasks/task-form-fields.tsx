import { useMemo, type Ref } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { WeekdaySelector } from '@/components/tasks/weekday-selector';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

type TaskFormFieldsProps = Readonly<{
  title: string;
  description: string;
  points: string;
  diasSemana: number;
  requiresEvidence: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPointsChange: (value: string) => void;
  onDiasSemanaChange: (value: number) => void;
  onRequiresEvidenceChange: (value: boolean) => void;
  autoFocusTitle?: boolean;
  titleInputRef?: Ref<TextInput>;
  weekdaysEditable?: boolean;
  pointsEditable?: boolean;
}>;

export function TaskFormFields({
  title,
  description,
  points,
  diasSemana,
  requiresEvidence,
  onTitleChange,
  onDescriptionChange,
  onPointsChange,
  onDiasSemanaChange,
  onRequiresEvidenceChange,
  autoFocusTitle = false,
  titleInputRef,
  weekdaysEditable = true,
  pointsEditable = true,
}: TaskFormFieldsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Input
        ref={titleInputRef}
        label="Título *"
        value={title}
        onChangeText={onTitleChange}
        noMarginBottom
        placeholder="Ex: Lavar a louça"
        maxLength={100}
        autoFocus={autoFocusTitle}
        accessibilityLabel="Título da tarefa"
      />

      <Input
        label="Descrição"
        value={description}
        onChangeText={onDescriptionChange}
        noMarginBottom
        placeholder="Detalhes da tarefa..."
        multiline
        numberOfLines={3}
        maxLength={500}
        style={styles.multilineInput}
        accessibilityLabel="Descrição da tarefa"
      />

      <Input
        label="Pontos *"
        value={points}
        onChangeText={(v) => onPointsChange(v.replaceAll(/\D/g, ''))}
        noMarginBottom
        placeholder="Ex: 10"
        keyboardType="number-pad"
        maxLength={4}
        editable={pointsEditable}
        style={pointsEditable ? undefined : styles.disabledInput}
        accessibilityLabel="Quantidade de pontos da tarefa"
      />

      <View style={styles.section}>
        <Text style={styles.label}>Repetir nos dias</Text>
        <WeekdaySelector
          value={diasSemana}
          onChange={onDiasSemanaChange}
          disabled={!weekdaysEditable}
        />
      </View>

      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.label}>Exige foto como evidência</Text>
          <Text style={styles.switchDescription}>
            Peça uma imagem para validar a conclusão da tarefa.
          </Text>
        </View>
        <Switch
          value={requiresEvidence}
          onValueChange={onRequiresEvidenceChange}
          trackColor={{ false: colors.border.default, true: colors.accent.admin }}
          thumbColor={colors.text.inverse}
          accessibilityLabel="Alternar exigência de foto como evidência"
        />
      </View>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      gap: spacing['4'],
    },
    multilineInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    disabledInput: {
      opacity: 0.55,
    },
    section: {
      marginBottom: spacing['2'],
    },
    label: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.secondary,
      marginBottom: spacing['2'],
    },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['3'],
      paddingVertical: spacing['3'],
      paddingHorizontal: spacing['3'],
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
    },
    switchText: {
      flex: 1,
    },
    switchDescription: {
      fontSize: typography.size.xs,
      color: colors.text.muted,
      lineHeight: typography.lineHeight.sm,
    },
  });
}
