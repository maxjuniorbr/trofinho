import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LogOut } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

type LogoutButtonProps = Readonly<{
  onPress: () => void;
  loading: boolean;
  disabled?: boolean;
}>;

export function LogoutButton({ onPress, loading, disabled }: LogoutButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.container,
        { borderColor: withAlpha(colors.semantic.error, 0.375), opacity: loading || disabled ? 0.55 : 1 },
      ]}
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityRole="button"
      accessibilityLabel="Sair da conta"
    >
      {loading ? (
        <ActivityIndicator color={colors.semantic.error} />
      ) : (
        <View style={styles.inner}>
          <LogOut size={16} color={colors.semantic.error} strokeWidth={2} />
          <Text style={[styles.text, { color: colors.semantic.error }]}>Sair</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    paddingVertical: spacing['3'],
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
    width: '100%',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['2'],
  },
  text: {
    fontSize: typography.size.md,
    fontFamily: typography.family.semibold,
  },
});
