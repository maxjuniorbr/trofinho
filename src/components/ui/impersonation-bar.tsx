import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, X } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

interface ImpersonationBarProps {
    childName: string;
    onExit: () => void;
}

type ReadonlyImpersonationBarProps = Readonly<ImpersonationBarProps>;

export function ImpersonationBar({ childName, onExit }: ReadonlyImpersonationBarProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[styles.container, { backgroundColor: colors.brand.vivid, paddingTop: insets.top + spacing['2'] }]}
            accessibilityRole="toolbar"
            accessibilityLabel={`Vendo como ${childName}`}
        >
            <View style={styles.left}>
                <Eye size={14} color={colors.text.onBrand} strokeWidth={2.5} />
                <Text style={[styles.label, { color: colors.text.onBrand }]} numberOfLines={1}>
                    Vendo como <Text style={styles.labelBold}>{childName}</Text>
                </Text>
            </View>

            <Pressable
                onPress={onExit}
                style={({ pressed }) => [
                    styles.exitButton,
                    { backgroundColor: withAlpha(colors.text.onBrand, pressed ? 0.25 : 0.15) },
                ]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sair do modo de visualização"
            >
                <X size={12} color={colors.text.onBrand} strokeWidth={3} />
                <Text style={[styles.exitLabel, { color: colors.text.onBrand }]}>Sair</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing['2'],
        paddingHorizontal: spacing['4'],
    },
    left: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['2'],
        flex: 1,
        minWidth: 0,
    },
    label: {
        fontSize: typography.size.xxs,
        fontFamily: typography.family.bold,
        flexShrink: 1,
    },
    labelBold: {
        fontFamily: typography.family.extrabold,
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1'],
        flexShrink: 0,
        marginLeft: spacing['3'],
        paddingHorizontal: spacing['2'],
        paddingVertical: spacing['1'],
        borderRadius: radii.full,
    },
    exitLabel: {
        fontSize: typography.size.xxs,
        fontFamily: typography.family.bold,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
});
