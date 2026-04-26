import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Eye, X } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';

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
                <Eye size={18} color={colors.text.onBrand} strokeWidth={2} />
                <Text style={[styles.label, { color: colors.text.onBrand }]} numberOfLines={1}>
                    Vendo como {childName}
                </Text>
            </View>

            <Pressable
                onPress={onExit}
                style={({ pressed }) => [styles.exitButton, { opacity: pressed ? 0.7 : 1 }]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Sair do modo de visualização"
            >
                <Text style={[styles.exitLabel, { color: colors.text.onBrand }]}>Sair</Text>
                <X size={16} color={colors.text.onBrand} strokeWidth={2.5} />
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
        fontSize: typography.size.sm,
        fontFamily: typography.family.semibold,
        flexShrink: 1,
    },
    exitButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1'],
        flexShrink: 0,
        marginLeft: spacing['3'],
    },
    exitLabel: {
        fontSize: typography.size.sm,
        fontFamily: typography.family.bold,
    },
});
