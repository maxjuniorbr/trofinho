import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { opacityDisabled, radii, spacing, typography } from '@/constants/theme';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

type GoogleSignInButtonProps = Readonly<{
    onPress: () => void;
    loading: boolean;
    disabled?: boolean;
    label?: string;
}>;

/**
 * Google "G" logo rendered as an inline SVG so we don't need an extra
 * image asset. Colors follow the official Google branding guidelines.
 */
function GoogleLogo({ size = 20 }: Readonly<{ size?: number }>) {
    return (
        <Svg width={size} height={size} viewBox="0 0 48 48">
            <Path
                d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
                fill="#FFC107"
            />
            <Path
                d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
                fill="#FF3D00"
            />
            <Path
                d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0124 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
                fill="#4CAF50"
            />
            <Path
                d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
                fill="#1976D2"
            />
        </Svg>
    );
}

/**
 * Styled "Entrar com Google" button following Google branding guidelines.
 * Uses a white/surface background with the multi-color Google "G" logo.
 */
export function GoogleSignInButton({
    onPress,
    loading,
    disabled = false,
    label = 'Entrar com Google',
}: GoogleSignInButtonProps) {
    const { colors } = useTheme();
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
                else if (pressed) opacity = 0.8;

                return [
                    styles.button,
                    {
                        backgroundColor: colors.bg.surface,
                        borderColor: colors.border.default,
                        opacity,
                    },
                ];
            }}
        >
            <View style={styles.content}>
                {loading ? (
                    <ActivityIndicator size="small" color={colors.text.primary} />
                ) : (
                    <GoogleLogo size={20} />
                )}
                <Text
                    style={[styles.label, { color: colors.text.primary }]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </View>
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        borderWidth: 1,
        borderRadius: radii.inner,
        borderCurve: 'continuous',
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
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
        fontFamily: typography.family.bold,
        fontSize: typography.size.md,
        lineHeight: typography.lineHeight.md,
    },
});
