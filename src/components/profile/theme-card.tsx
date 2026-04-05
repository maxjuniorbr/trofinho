import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sun, Moon, Smartphone } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type ColorScheme = 'light' | 'dark' | 'system';

const THEME_OPTIONS: readonly { value: ColorScheme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Escuro', Icon: Moon },
  { value: 'system', label: 'Sistema', Icon: Smartphone },
];

export function ThemeCard() {
  const { colors, scheme, setScheme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
      ]}
    >
      <Text style={[styles.title, { color: colors.text.primary }]}>Aparência</Text>
      <View style={styles.row}>
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const isActive = scheme === value;
          return (
            <Pressable
              key={value}
              style={[
                styles.option,
                {
                  backgroundColor: isActive ? colors.accent.adminDim : colors.bg.elevated,
                  borderColor: isActive ? colors.accent.adminDim : colors.border.subtle,
                },
              ]}
              onPress={() => setScheme(value)}
              accessibilityRole="button"
              accessibilityLabel={`Tema ${label}`}
              accessibilityState={{ selected: isActive }}
            >
              <Icon
                size={16}
                color={isActive ? colors.text.inverse : colors.text.secondary}
                strokeWidth={2}
              />
              <Text
                style={[
                  styles.optionLabel,
                  { color: isActive ? colors.text.inverse : colors.text.secondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['4'], gap: spacing['1'] },
  title: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.md,
    marginBottom: spacing['2'],
  },
  row: { flexDirection: 'row', gap: spacing['2'] },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing['2'],
    paddingVertical: spacing['3'],
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionLabel: { fontSize: typography.size.sm, fontFamily: typography.family.semibold },
});
