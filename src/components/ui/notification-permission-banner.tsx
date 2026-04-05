import { Linking, StyleSheet, Text, View } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

async function openNotificationSettings() {
  await Linking.openSettings();
}

export function NotificationPermissionBanner() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.semantic.warningBg,
          borderColor: withAlpha(colors.semantic.warning, 0.25),
        },
      ]}
    >
      <View style={styles.content}>
        <View style={[styles.iconBox, { backgroundColor: colors.bg.surface }]}>
          <BellOff size={18} color={colors.semantic.warningText} strokeWidth={2} />
        </View>
        <View style={styles.textBox}>
          <Text style={[styles.title, { color: colors.text.primary }]}>
            Notificações desativadas
          </Text>
          <Text style={[styles.message, { color: colors.text.secondary }]}>
            Ative nas configurações para receber avisos do Trofinho.
          </Text>
        </View>
      </View>

      <Button
        label="Abrir ajustes"
        size="sm"
        variant="secondary"
        onPress={openNotificationSettings}
        accessibilityLabel="Abrir ajustes do app"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing['4'],
    gap: spacing['3'],
    width: '100%',
    marginBottom: spacing['6'],
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing['3'],
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBox: {
    flex: 1,
    gap: spacing['1'],
  },
  title: {
    fontSize: typography.size.md,
    fontFamily: typography.family.bold,
  },
  message: {
    fontSize: typography.size.sm,
    fontFamily: typography.family.medium,
    lineHeight: typography.lineHeight.sm,
  },
});
