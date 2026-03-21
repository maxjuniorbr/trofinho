import { Linking, StyleSheet, Text, View } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

export function NotificationPermissionBanner() {
  const { colors } = useTheme();

  async function handleOpenSettings() {
    await Linking.openSettings();
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.semantic.warningBg,
          borderColor: colors.semantic.warning + '40',
        },
      ]}
    >
      <View style={styles.content}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: colors.bg.surface },
          ]}
        >
          <BellOff
            size={18}
            color={colors.semantic.warningText}
            strokeWidth={2}
          />
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
        onPress={handleOpenSettings}
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
