import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text } from 'react-native';
import { gradients, radii, spacing, staticTextColors, typography } from '@/constants/theme';

type TaskPointsPillProps = Readonly<{
  points: number;
  prefix?: string;
  suffix?: string;
  size?: 'sm' | 'md';
}>;

export function TaskPointsPill({
  points,
  prefix = '',
  suffix = ' pts',
  size = 'sm',
}: TaskPointsPillProps) {
  return (
    <LinearGradient
      colors={gradients.gold.colors}
      start={gradients.goldHorizontal.start}
      end={gradients.goldHorizontal.end}
      style={[styles.base, size === 'md' ? styles.md : styles.sm]}
    >
      <Text style={[styles.text, size === 'md' ? styles.textMd : styles.textSm]}>
        {prefix}
        {points}
        {suffix}
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderRadius: radii.md,
    overflow: 'hidden',
  },
  sm: {
    paddingHorizontal: spacing['2'],
    paddingVertical: spacing['1'],
  },
  md: {
    paddingHorizontal: spacing['3'],
    paddingVertical: spacing['1.5'],
  },
  text: {
    color: staticTextColors.onBrand,
    fontFamily: typography.family.bold,
    fontVariant: ['tabular-nums'] as const,
  },
  textSm: {
    fontSize: typography.size.xs,
  },
  textMd: {
    fontSize: typography.size.sm,
  },
});
