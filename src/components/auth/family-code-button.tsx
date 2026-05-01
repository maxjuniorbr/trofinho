import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { gradients, opacityDisabled, radii, shadows, spacing, typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';

type FamilyCodeButtonProps = Readonly<{
    onPress: () => void;
    loading?: boolean;
    disabled?: boolean;
    label?: string;
}>;

/**
 * Gold-gradient CTA button for the "Usar código de família" login path.
 * Matches the creative-studio design: gradient-brand background, dark text,
 * trailing arrow, and brand shadow.
 */
export function FamilyCodeButton({
    onPress,
    loading = false,
    disabled = false,
    label = 'Usar código de família',
}: FamilyCodeButtonProps) {
    const isDisabled = disabled || loading;

    const handlePress = () => {
        if (!isDisabled) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
            onPress();
        }
    };

    return (
        <Pressable
            onPress={handlePress}
            disabled={isDisabled}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled: isDisabled, busy: loading }}
            style={({ pressed }) => {
                let opacity = 1;
                if (isDisabled) opacity = opacityDisabled.heavy;
                else if (pressed) opacity = 0.9;
                return [styles.wrapper, { opacity }];
            }}
        >
            <LinearGradient
                colors={gradients.goldHorizontal.colors}
                start={gradients.goldHorizontal.start}
                end={gradients.goldHorizontal.end}
                style={styles.gradient}
            >
                <View style={styles.content}>
                    {loading ? (
                        <ActivityIndicator size="small" color="#030711" />
                    ) : null}
                    <Text style={styles.label} numberOfLines={1}>
                        {label}
                    </Text>
                    {loading ? null : (
                        <ArrowRight size={16} color="#030711" strokeWidth={2.5} />
                    )}
                </View>
            </LinearGradient>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: radii.inner,
        borderCurve: 'continuous',
        overflow: 'hidden',
        ...shadows.goldButton,
    },
    gradient: {
        minHeight: 52,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radii.inner,
        borderCurve: 'continuous',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['3'],
        paddingHorizontal: spacing['6'],
        paddingVertical: spacing['3'],
    },
    label: {
        flex: 1,
        fontFamily: typography.family.extrabold,
        fontSize: 15,
        lineHeight: 20,
        color: '#030711',
    },
});
