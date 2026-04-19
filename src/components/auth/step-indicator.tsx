import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { heroPalette, radii, spacing, typography } from '@/constants/theme';

type StepIndicatorProps = Readonly<{
    currentStep: 1 | 2;
    totalSteps?: number;
    labels?: readonly string[];
}>;

const ACTIVE = heroPalette.borderFocus;
const DONE = 'rgba(250, 193, 20, 0.40)';
const INACTIVE = 'rgba(255, 255, 255, 0.15)';

export const StepIndicator = ({ currentStep, totalSteps = 2, labels }: StepIndicatorProps) => {
    const styles = useMemo(() => makeStyles(), []);

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
                {Array.from({ length: totalSteps }, (_, i) => (
                    <View key={i} style={[styles.bar, { backgroundColor: getBarColor(i) }]} />
                ))}
            </View>
            {labels ? (
                <View style={styles.labels}>
                    {labels.map((label, i) => (
                        <Text key={i} style={getLabelStyle(i)} allowFontScaling={false}>
                            {i + 1 < currentStep ? `${label} ✓` : label}
                        </Text>
                    ))}
                </View>
            ) : null}
        </View>
    );
};

function makeStyles() {
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
            color: heroPalette.borderFocus,
        },
        labelDone: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xxs,
            letterSpacing: 1.2,
            color: 'rgba(250, 193, 20, 0.55)',
        },
        labelInactive: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xxs,
            letterSpacing: 1.2,
            color: 'rgba(255, 255, 255, 0.35)',
        },
    });
}
