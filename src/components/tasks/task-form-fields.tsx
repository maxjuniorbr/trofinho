import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import type { TaskFrequencia } from '@lib/tasks';

type TaskFormFieldsProps = Readonly<{
  title: string;
  description: string;
  points: string;
  frequency: TaskFrequencia;
  requiresEvidence: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPointsChange: (value: string) => void;
  onFrequencyChange: (value: TaskFrequencia) => void;
  onRequiresEvidenceChange: (value: boolean) => void;
  autoFocusTitle?: boolean;
  frequencyEditable?: boolean;
  pointsEditable?: boolean;
}>;

type FrequencyOption = Readonly<{
  description: string;
  label: string;
  value: TaskFrequencia;
}>;

const FREQUENCY_OPTIONS: readonly FrequencyOption[] = [
  { value: 'unica', label: 'Única', description: 'Realizada uma vez' },
  { value: 'diaria', label: 'Diária', description: 'Repetida todo dia' },
];

export function TaskFormFields({
  title,
  description,
  points,
  frequency,
  requiresEvidence,
  onTitleChange,
  onDescriptionChange,
  onPointsChange,
  onFrequencyChange,
  onRequiresEvidenceChange,
  autoFocusTitle = false,
  frequencyEditable = true,
  pointsEditable = true,
}: TaskFormFieldsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <Input
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
        onChangeText={onPointsChange}
        noMarginBottom
        placeholder="Ex: 10"
        keyboardType="numeric"
        maxLength={4}
        editable={pointsEditable}
        style={!pointsEditable ? styles.disabledInput : undefined}
        accessibilityLabel="Quantidade de pontos da tarefa"
      />

      <View style={styles.section}>
        <Text style={styles.label}>Frequência *</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCY_OPTIONS.map((option) => {
            const selected = option.value === frequency;

            return (
              <Pressable
                key={option.value}
                style={[
                  styles.frequencyButton,
                  {
                    borderColor: selected ? colors.accent.admin : colors.border.default,
                    backgroundColor: selected ? colors.accent.adminBg : colors.bg.surface,
                    opacity: frequencyEditable ? 1 : 0.55,
                  },
                ]}
                onPress={() => {
                  if (frequencyEditable) {
                    onFrequencyChange(option.value);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Selecionar frequência ${option.label.toLowerCase()}`}
                accessibilityState={{ selected, disabled: !frequencyEditable }}
              >
                <Text
                  style={[
                    styles.frequencyTitle,
                    { color: selected ? colors.accent.admin : colors.text.primary },
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.frequencyDescription,
                    { color: selected ? colors.accent.admin : colors.text.muted },
                  ]}
                >
                  {option.description}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
    frequencyRow: {
      flexDirection: 'row',
      gap: spacing['2'],
    },
    frequencyButton: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      gap: spacing['1'],
      minHeight: 88,
      justifyContent: 'center',
    },
    frequencyTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
    },
    frequencyDescription: {
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.sm,
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
