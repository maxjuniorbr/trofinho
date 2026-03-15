import { useMemo } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

type PrizeFormFieldsProps = Readonly<{
  name: string;
  description: string;
  cost: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onCostChange: (value: string) => void;
  autoFocusName?: boolean;
}>;

export function PrizeFormFields({
  name,
  description,
  cost,
  onNameChange,
  onDescriptionChange,
  onCostChange,
  autoFocusName = false,
}: PrizeFormFieldsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>Nome *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={onNameChange}
          placeholder="Ex: Sorvete, Filme no cinema…"
          placeholderTextColor={colors.text.muted}
          autoFocus={autoFocusName}
          returnKeyType="next"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Descrição</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={onDescriptionChange}
          placeholder="Detalhes opcionais…"
          placeholderTextColor={colors.text.muted}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Custo em pontos *</Text>
        <TextInput
          style={styles.input}
          value={cost}
          onChangeText={onCostChange}
          placeholder="Ex: 50"
          placeholderTextColor={colors.text.muted}
          keyboardType="numeric"
          returnKeyType="done"
        />
      </View>
    </>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: { gap: spacing['2'] },
    label: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.semibold,
      color: colors.text.secondary,
    },
    input: {
      backgroundColor: colors.bg.surface,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.default,
      paddingHorizontal: spacing['3'],
      paddingVertical: spacing['3'],
      fontSize: typography.size.md,
      color: colors.text.primary,
      minHeight: 48,
    },
    multilineInput: { minHeight: 80, paddingTop: spacing['3'] },
  });
}
