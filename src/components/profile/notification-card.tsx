import { StyleSheet, Switch, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { InlineMessage } from '@/components/ui/inline-message';
import { radii, spacing, typography } from '@/constants/theme';
import type { NotificationPrefs } from '@lib/notifications';

type NotificationOption = Readonly<{
  key: keyof NotificationPrefs;
  label: string;
  roles: readonly ('admin' | 'filho')[];
}>;

const OPTIONS: readonly NotificationOption[] = [
  { key: 'tarefasPendentes', label: 'Tarefas pendentes', roles: ['admin'] },
  { key: 'tarefaAprovada', label: 'Tarefa aprovada', roles: ['filho'] },
  { key: 'tarefaRejeitada', label: 'Tarefa rejeitada', roles: ['filho'] },
  { key: 'tarefaConcluida', label: 'Tarefa concluída pelo filho', roles: ['admin'] },
  { key: 'resgatesSolicitado', label: 'Resgate solicitado', roles: ['admin'] },
  { key: 'resgateConfirmado', label: 'Resgate confirmado', roles: ['filho'] },
  { key: 'resgateCancelado', label: 'Resgate cancelado', roles: ['filho'] },
];

type NotificationCardProps = Readonly<{
  preferences: NotificationPrefs;
  saving?: boolean;
  error?: string | null;
  role?: 'admin' | 'filho';
  onPreferencesChange: (prefs: NotificationPrefs) => void | Promise<void>;
}>;

export function NotificationCard({
  preferences,
  saving = false,
  error = null,
  role = 'admin',
  onPreferencesChange,
}: NotificationCardProps) {
  const { colors } = useTheme();
  const accentColor = role === 'filho' ? colors.accent.filhoDim : colors.accent.adminDim;

  const handleToggle = (key: keyof NotificationPrefs, value: boolean) => {
    onPreferencesChange({ ...preferences, [key]: value });
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <View style={styles.titleRow}>
        <Bell size={16} color={colors.text.primary} strokeWidth={2} />
        <Text style={[styles.title, { color: colors.text.primary }]}>Notificações</Text>
      </View>

      {OPTIONS.filter((o) => o.roles.includes(role)).map(({ key, label }, index, arr) => (
        <View
          key={key}
          style={[
            styles.row,
            index < arr.length - 1 && {
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
              true: accentColor,
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

      {error ? <InlineMessage message={error} variant="error" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing['4'],
    gap: spacing['1'],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    marginBottom: spacing['2'],
  },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.md,
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
