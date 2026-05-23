import { StyleSheet, Text, View } from 'react-native';
import { spacing, typography } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type AuthSeparatorProps = Readonly<{
    label?: string;
}>;

export function AuthSeparator({ label = 'ou' }: AuthSeparatorProps) {
    const { palette } = useHeroPalette();
    return (
        <View style={styles.row}>
            <View style={[styles.line, { backgroundColor: palette.borderSoft }]} />
            <Text style={[styles.text, { color: palette.textOnNavyFaint }]}>{label}</Text>
            <View style={[styles.line, { backgroundColor: palette.borderSoft }]} />
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['3'],
    },
    line: {
        flex: 1,
        height: 1,
    },
    text: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.xs,
        lineHeight: typography.lineHeight.xs,
    },
});
