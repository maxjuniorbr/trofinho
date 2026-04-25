import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withAlpha } from '@/constants/colors';
import { radii, spacing, typography } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type StepIndicatorProps = Readonly<{
  currentStep: 1 | 2;
  totalSteps?: number;
  labels?: readonly string[];
}>;

export const StepIndicator = ({ currentStep, totalSteps = 2, labels }: StepIndicatorProps) => {
  const { palette } = useHeroPalette();
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const ACTIVE = palette.borderFocus;
  const DONE = withAlpha(palette.borderFocus, 0.4);
  const INACTIVE = withAlpha(palette.textOnNavy, 0.15);

  const getBarColor = (index: number): string => {
    const step = index + 1;
    if (step === currentStep) return ACTIVE;
    if (step < currentStep) return DONE;
    return INACTIVE;
  };

  const getLabelStyle = (index: number) => {
    const step = index + 1;
    if (step === currentStep) return styles.labelActive;
    if (step < currentStep) return styles.labelDone;
    return styles.labelInactive;
  };

  return (
    <View
      style={styles.container}
      accessibilityLabel={`Passo ${currentStep} de ${totalSteps}`}
      accessibilityRole="progressbar"
    >
      <View style={styles.bars}>
        {Array.from({ length: totalSteps }, (_, i) => `bar-step-${i + 1}`).map((id, i) => (
          <View key={id} style={[styles.bar, { backgroundColor: getBarColor(i) }]} />
        ))}
      </View>
      {labels ? (
        <View style={styles.labels}>
          {labels.map((label, i) => (
            <Text key={label} style={getLabelStyle(i)} allowFontScaling={false}>
              {i + 1 < currentStep ? `${label} ✓` : label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
  return StyleSheet.create({
    container: {
      marginTop: spacing['6'],
    },
    bars: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['2'],
    },
    bar: {
      flex: 1,
      height: 4,
      borderRadius: radii.full,
    },
    labels: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing['1.5'],
    },
    labelActive: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.2,
      color: palette.borderFocus,
    },
    labelDone: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.2,
      color: withAlpha(palette.borderFocus, 0.55),
    },
    labelInactive: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 1.2,
      color: withAlpha(palette.textOnNavy, 0.35),
    },
  });
}
