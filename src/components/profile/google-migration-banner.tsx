import { StyleSheet, Text, View } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

type GoogleMigrationBannerProps = Readonly<{
    onLinkGoogle: () => void;
}>;

/**
 * Banner displayed on the profile screen encouraging users to link their
 * Google account. Should only be rendered when
 * `shouldShowGoogleMigrationBanner()` returns `true`.
 */
export function GoogleMigrationBanner({ onLinkGoogle }: GoogleMigrationBannerProps) {
    const { colors } = useTheme();

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.semantic.infoBg,
                    borderColor: withAlpha(colors.semantic.info, 0.25),
                },
            ]}
            accessibilityRole="alert"
        >
            <View style={styles.content}>
                <View style={[styles.iconBox, { backgroundColor: colors.bg.surface }]}>
                    <ShieldCheck
                        size={18}
                        color={colors.semantic.infoText}
                        strokeWidth={2}
                    />
                </View>
                <View style={styles.textBox}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>
                        Vincule sua conta Google
                    </Text>
                    <Text style={[styles.message, { color: colors.text.secondary }]}>
                        Acesse o Trofinho de forma mais rápida e segura usando sua conta
                        Google. Você não precisará mais de senha.
                    </Text>
                </View>
            </View>

            <Button
                label="Vincular Google"
                size="sm"
                variant="secondary"
                onPress={onLinkGoogle}
                accessibilityLabel="Vincular conta Google"
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        padding: spacing['4'],
        gap: spacing['3'],
        width: '100%',
    },
    content: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing['3'],
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: radii.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textBox: {
        flex: 1,
        gap: spacing['1'],
    },
    title: {
        fontSize: typography.size.md,
        fontFamily: typography.family.bold,
    },
    message: {
        fontSize: typography.size.sm,
        fontFamily: typography.family.medium,
        lineHeight: typography.lineHeight.sm,
    },
});
