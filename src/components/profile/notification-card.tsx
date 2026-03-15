import { StyleSheet, Switch, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { deviceStorage } from '@lib/device-storage';
import { radii, spacing, typography } from '@/constants/theme';

const NOTIFICATION_PREFERENCES_KEY = 'notification_prefs';

export type NotificationPreferences = {
  pendingTasks: boolean;
  completedTask: boolean;
  requestedRedemption: boolean;
};

type LegacyNotificationPreferences = Partial<{
  tarefas_pendentes: boolean;
  tarefa_concluida: boolean;
  resgate_solicitado: boolean;
}>;

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  pendingTasks: true,
  completedTask: true,
  requestedRedemption: true,
};

const OPTIONS: ReadonlyArray<{ key: keyof NotificationPreferences; label: string }> = [
  { key: 'pendingTasks', label: 'Tarefas pendentes' },
  { key: 'completedTask', label: 'Tarefa concluída pelo filho' },
  { key: 'requestedRedemption', label: 'Resgate solicitado' },
];

export function normalizeNotificationPreferences(
  rawPreferences: string | null,
): NotificationPreferences {
  if (!rawPreferences) return DEFAULT_NOTIFICATION_PREFERENCES;

  try {
    const parsed = JSON.parse(rawPreferences) as Partial<NotificationPreferences>
      & LegacyNotificationPreferences;

    return {
      pendingTasks:
        parsed.pendingTasks ?? parsed.tarefas_pendentes ?? DEFAULT_NOTIFICATION_PREFERENCES.pendingTasks,
      completedTask:
        parsed.completedTask ?? parsed.tarefa_concluida ?? DEFAULT_NOTIFICATION_PREFERENCES.completedTask,
      requestedRedemption:
        parsed.requestedRedemption
        ?? parsed.resgate_solicitado
        ?? DEFAULT_NOTIFICATION_PREFERENCES.requestedRedemption,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFERENCES;
  }
}

type NotificationCardProps = Readonly<{
  preferences: NotificationPreferences;
  onPreferencesChange: (prefs: NotificationPreferences) => void;
}>;

export function NotificationCard({ preferences, onPreferencesChange }: NotificationCardProps) {
  const { colors } = useTheme();

  async function handleToggle(key: keyof NotificationPreferences, value: boolean) {
    const next = { ...preferences, [key]: value };
    onPreferencesChange(next);
    await deviceStorage.setItem(NOTIFICATION_PREFERENCES_KEY, JSON.stringify(next));
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
      <Text style={[styles.title, { color: colors.text.primary }]}>Notificações</Text>

      {OPTIONS.map(({ key, label }, index) => (
        <View
          key={key}
          style={[
            styles.row,
            index < OPTIONS.length - 1
              && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
          ]}
        >
          <Text style={[styles.label, { color: colors.text.primary }]}>{label}</Text>
          <Switch
            value={preferences[key]}
            onValueChange={(value) => handleToggle(key, value)}
            trackColor={{ false: colors.border.default, true: colors.accent.adminDim }}
            thumbColor={colors.text.inverse}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'], gap: spacing['1'] },
  title: { fontFamily: typography.family.bold, fontSize: typography.size.md, marginBottom: spacing['2'] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing['3'] },
  label: { fontSize: typography.size.md, fontFamily: typography.family.medium, flex: 1, paddingRight: spacing['3'] },
});
