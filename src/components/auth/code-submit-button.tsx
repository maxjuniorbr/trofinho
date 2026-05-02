import { Pressable, StyleSheet, type AccessibilityState } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight } from 'lucide-react-native';
import { staticTextColors } from '@/constants/colors';
import { gradients, radii, shadows } from '@/constants/theme';

type CodeSubmitButtonProps = Readonly<{
    onPress: () => void;
    disabled?: boolean;
    busy?: boolean;
    accessibilityLabel: string;
}>;

/**
 * Gold gradient submit affordance used next to single-line code inputs in the
 * auth flows (login and join-family). Height is tuned to match the input row
 * height (50). Padding is intentionally kept off the spacing scale to keep
 * the icon visually centered with the adjacent caps-locked code text.
 */
export function CodeSubmitButton({
    onPress,
    disabled = false,
    busy = false,
    accessibilityLabel,
}: CodeSubmitButtonProps) {
    const accessibilityState: AccessibilityState = { busy, disabled };
    return (
        <Pressable
            onPress={onPress}
            disabled={disabled}
            style={({ pressed }) => {
                let opacity = 1;
                if (disabled) opacity = 0.6;
                else if (pressed) opacity = 0.9;
                return [styles.button, { opacity }];
            }}
            accessibilityRole="button"
            accessibilityLabel={accessibilityLabel}
            accessibilityState={accessibilityState}
        >
            <LinearGradient
                colors={gradients.goldHorizontal.colors}
                start={gradients.goldHorizontal.start}
                end={gradients.goldHorizontal.end}
                style={styles.gradient}
            >
                <ArrowRight size={18} color={staticTextColors.onBrand} strokeWidth={2.5} />
            </LinearGradient>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        borderRadius: radii.md,
        overflow: 'hidden',
        ...shadows.goldButtonGlow,
    },
    gradient: {
        height: 50,
        paddingHorizontal: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
