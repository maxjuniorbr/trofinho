import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { PiggyBank, Wallet } from 'lucide-react-native';
import { staticTextColors } from '@/constants/colors';
import { gradients, radii, spacing, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

type BalanceCardsRowProps = Readonly<{
    freeBalance: number;
    piggyBalance: number;
}>;

/**
 * Two side-by-side balance cards used by both the child balance screen and
 * the admin per-child balance screen. Left card is the gold free-balance
 * gradient; right card is the surface-level cofrinho summary.
 */
export function BalanceCardsRow({ freeBalance, piggyBalance }: BalanceCardsRowProps) {
    const { colors } = useTheme();
    return (
        <View style={styles.row}>
            <LinearGradient
                colors={gradients.gold.colors}
                start={gradients.gold.start}
                end={gradients.gold.end}
                style={styles.card}
            >
                <View style={styles.top}>
                    <Wallet size={14} color={staticTextColors.inverseStrong} strokeWidth={2} />
                    <Text style={styles.label}>SALDO LIVRE</Text>
                </View>
                <Text style={styles.value}>{freeBalance.toLocaleString('pt-BR')}</Text>
                <Text style={styles.unit}>pontos</Text>
            </LinearGradient>

            <View
                style={[
                    styles.card,
                    styles.cofrinhoCard,
                    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                ]}
            >
                <View style={styles.top}>
                    <PiggyBank size={14} color={colors.text.muted} strokeWidth={2} />
                    <Text style={[styles.label, { color: colors.text.muted }]}>COFRINHO</Text>
                </View>
                <Text style={[styles.value, { color: colors.text.primary }]}>
                    {piggyBalance.toLocaleString('pt-BR')}
                </Text>
                <Text style={[styles.unit, { color: colors.text.muted }]}>pontos</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: spacing['3'],
        marginBottom: spacing['3'],
    },
    card: {
        flex: 1,
        borderRadius: radii.xl,
        borderCurve: 'continuous',
        padding: spacing['4'],
    },
    cofrinhoCard: {
        borderWidth: 1,
    },
    top: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1'],
        marginBottom: spacing['1'],
    },
    label: {
        fontSize: typography.size.xxs,
        fontFamily: typography.family.semibold,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        color: staticTextColors.inverseStrong,
    },
    value: {
        fontSize: typography.size['3xl'],
        fontFamily: typography.family.extrabold,
        fontVariant: ['tabular-nums'],
        color: staticTextColors.inverse,
    },
    unit: {
        fontSize: typography.size.xxs,
        fontFamily: typography.family.medium,
        color: staticTextColors.inverseFaint,
        marginTop: spacing['0.5'],
    },
});
