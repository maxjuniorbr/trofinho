import { StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';

type SteppedSliderProps = Readonly<{
  value: number;
  onValueChange: (value: number) => void;
  onSlidingComplete: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
  disabled?: boolean;
  accessibilityLabel: string;
}>;

export function SteppedSlider({
  value,
  onValueChange,
  onSlidingComplete,
  min = 0,
  max = 50,
  step = 5,
  formatValue = (v) => `${v}%`,
  disabled = false,
  accessibilityLabel,
}: SteppedSliderProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.value, { color: colors.text.primary }]}>{formatValue(value)}</Text>
      </View>
      <Slider
        style={styles.slider}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onValueChange}
        onSlidingComplete={onSlidingComplete}
        minimumTrackTintColor={colors.accent.admin}
        maximumTrackTintColor={colors.bg.muted}
        thumbTintColor={colors.accent.admin}
        disabled={disabled}
        accessibilityLabel={accessibilityLabel}
      />
      <View style={styles.rangeRow}>
        <Text style={[styles.rangeLabel, { color: colors.text.muted }]}>{formatValue(min)}</Text>
        <Text style={[styles.rangeLabel, { color: colors.text.muted }]}>{formatValue(max)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing['1'] },
  labelRow: { alignItems: 'center' },
  value: {
    fontSize: typography.size['2xl'],
    fontFamily: typography.family.extrabold,
  },
  slider: { width: '100%', height: 40 },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -spacing['1'],
  },
  rangeLabel: {
    fontSize: typography.size.xs,
    fontFamily: typography.family.medium,
  },
});
