import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type PathCardProps = Readonly<{
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    cta: ReactNode;
}>;

/**
 * Glassmorphism-style card used on the login screen to present distinct
 * authentication paths (e.g. "Responsável" vs "Filho ou membro"). Follows
 * the creative-studio reference design.
 */
export function PathCard({ icon, eyebrow, title, description, cta }: PathCardProps) {
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(palette), [palette]);

    return (
        <View style={styles.card}>
            <View style={styles.header}>
                <View style={styles.iconBox}>{icon}</View>
                <Text style={styles.eyebrow}>{eyebrow}</Text>
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{description}</Text>
            {cta}
        </View>
    );
}

function makeStyles(palette: ReturnType<typeof useHeroPalette>['palette']) {
    return StyleSheet.create({
        card: {
            borderRadius: radii.outer,
            backgroundColor: palette.surfaceField,
            borderWidth: 1,
            borderColor: palette.borderSoft,
            padding: spacing['5'],
        },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
        },
        iconBox: {
            width: 40,
            height: 40,
            borderRadius: radii.md,
            backgroundColor: 'rgba(250, 193, 20, 0.15)',
            borderWidth: 1,
            borderColor: 'rgba(250, 193, 20, 0.30)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        eyebrow: {
            fontFamily: typography.family.extrabold,
            fontSize: typography.size.xxs,
            lineHeight: typography.lineHeight.xxs,
            color: palette.textOnNavySubtle,
            textTransform: 'uppercase',
            letterSpacing: 1.4,
        },
        title: {
            marginTop: spacing['4'],
            fontFamily: typography.family.black,
            fontSize: typography.size.lg,
            lineHeight: typography.lineHeight.lg,
            color: palette.textOnNavy,
        },
        description: {
            marginTop: spacing['1.5'],
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs + 1,
            lineHeight: typography.lineHeight.sm,
            color: palette.textOnNavyMuted,
        },
    });
}
