import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import type { NotificationPrefs } from '@lib/notifications';

const OPTIONS: ReadonlyArray<{
  key: keyof NotificationPrefs;
  label: string;
}> = [
  { key: 'tarefasPendentes', label: 'Tarefas pendentes' },
  { key: 'tarefaConcluida', label: 'Tarefa concluída pelo filho' },
  { key: 'resgatesSolicitado', label: 'Resgate solicitado' },
];

type NotificationCardProps = Readonly<{
  preferences: NotificationPrefs;
  saving?: boolean;
  error?: string | null;
  onPreferencesChange: (prefs: NotificationPrefs) => void | Promise<void>;
}>;

export function NotificationCard({
  preferences,
  saving = false,
  error = null,
  onPreferencesChange,
}: NotificationCardProps) {
  const { colors } = useTheme();

  function handleToggle(key: keyof NotificationPrefs, value: boolean) {
    void onPreferencesChange({ ...preferences, [key]: value });
  }

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <Text style={[styles.title, { color: colors.text.primary }]}>Notificações</Text>

      {OPTIONS.map(({ key, label }, index) => (
        <View
          key={key}
          style={[
            styles.row,
            index < OPTIONS.length - 1
              && {
                borderBottomWidth: 1,
                borderBottomColor: colors.border.subtle,
              },
          ]}
        >
          <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
          <Switch
            value={preferences[key]}
            disabled={saving}
            onValueChange={(value) => handleToggle(key, value)}
            accessibilityLabel={label}
            accessibilityState={{ disabled: saving }}
            trackColor={{
              false: colors.border.default,
              true: colors.accent.adminDim,
            }}
            thumbColor={colors.text.inverse}
          />
        </View>
      ))}

      {saving ? (
        <Text style={[styles.feedbackText, { color: colors.text.secondary }]}>
          Salvando preferências...
        </Text>
      ) : null}

      {error ? (
        <Text style={[styles.feedbackText, { color: colors.semantic.error }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing['4'],
    gap: spacing['1'],
  },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.md,
    marginBottom: spacing['2'],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing['3'],
  },
  label: {
    fontSize: typography.size.md,
    fontFamily: typography.family.medium,
    flex: 1,
    paddingRight: spacing['3'],
  },
  feedbackText: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.medium,
    marginTop: spacing['2'],
  },
});
