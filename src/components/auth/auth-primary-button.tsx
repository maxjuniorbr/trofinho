import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { gradients, radii, shadows, spacing, typography } from '@/constants/theme';

type AuthPrimaryButtonProps = Readonly<{
  label: string;
  loadingLabel: string;
  loading: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}>;

export function AuthPrimaryButton({
  label,
  loadingLabel,
  loading,
  onPress,
  accessibilityLabel,
}: AuthPrimaryButtonProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: loading, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        shadows.goldButton,
        { opacity: loading ? 0.55 : 1, transform: pressed ? [{ translateY: 2 }] : [] },
      ]}
    >
      <LinearGradient
        colors={gradients.gold.colors}
        start={gradients.gold.start}
        end={gradients.gold.end}
        style={styles.gradient}
      >
        {loading ? (
          <View style={styles.loadingContent}>
            <ActivityIndicator size="small" color={colors.text.onBrand} />
            <Text style={[styles.text, { color: colors.text.onBrand }]}>
              {loadingLabel}
            </Text>
          </View>
        ) : (
          <Text style={[styles.text, { color: colors.text.onBrand }]}>{label}</Text>
        )}
      </LinearGradient>
    </Pressable>
  );
}

function makeStyles() {
  return StyleSheet.create({
    button: {
      borderRadius: radii.inner,
      overflow: 'hidden',
      minHeight: 56,
    },
    gradient: {
      paddingVertical: spacing['4'],
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.inner,
      flex: 1,
    },
    loadingContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    text: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.md,
    },
  });
}
