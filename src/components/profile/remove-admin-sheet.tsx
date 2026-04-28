import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

// ── Props ────────────────────────────────────────────────

type RemoveAdminSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    adminName: string;
    onConfirm: () => void;
    isRemoving: boolean;
}>;

// ── Component ────────────────────────────────────────────

export function RemoveAdminSheet({
    visible,
    onClose,
    adminName,
    onConfirm,
    isRemoving,
}: RemoveAdminSheetProps) {
    const { colors } = useTheme();

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            closeLabel="Fechar confirmação de remoção"
        >
            <View style={styles.body}>
                <View
                    style={[
                        styles.iconContainer,
                        { backgroundColor: withAlpha(colors.semantic.error, 0.1) },
                    ]}
                >
                    <AlertTriangle size={24} color={colors.semantic.error} strokeWidth={2} />
                </View>

                <Text style={[styles.title, { color: colors.text.primary }]}>
                    Remover administrador
                </Text>

                <Text style={[styles.message, { color: colors.text.secondary }]}>
                    Deseja remover {adminName} como administrador desta família?
                </Text>

                <View style={styles.actions}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.confirmBtn,
                            {
                                backgroundColor: pressed
                                    ? withAlpha(colors.semantic.error, 0.85)
                                    : colors.semantic.error,
                            },
                        ]}
                        onPress={onConfirm}
                        disabled={isRemoving}
                        accessibilityRole="button"
                        accessibilityLabel={`Remover ${adminName} como administrador`}
                    >
                        {isRemoving ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.confirmBtnText}>Remover</Text>
                        )}
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.cancelBtn,
                            {
                                backgroundColor: pressed
                                    ? withAlpha(colors.text.primary, 0.05)
                                    : 'transparent',
                                borderColor: colors.border.subtle,
                            },
                        ]}
                        onPress={onClose}
                        disabled={isRemoving}
                        accessibilityRole="button"
                        accessibilityLabel="Cancelar remoção"
                    >
                        <Text style={[styles.cancelBtnText, { color: colors.text.primary }]}>
                            Cancelar
                        </Text>
                    </Pressable>
                </View>
            </View>
        </BottomSheetModal>
    );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
    body: {
        alignItems: 'center',
        gap: spacing['3'],
        paddingBottom: spacing['2'],
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: radii.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: typography.size.lg,
        fontFamily: typography.family.bold,
        textAlign: 'center',
    },
    message: {
        fontSize: typography.size.sm,
        fontFamily: typography.family.medium,
        textAlign: 'center',
        lineHeight: typography.lineHeight.sm,
    },
    actions: {
        width: '100%',
        gap: spacing['2'],
        marginTop: spacing['2'],
    },
    confirmBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['4'],
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        minHeight: 48,
    },
    confirmBtnText: {
        color: '#fff',
        fontFamily: typography.family.bold,
        fontSize: typography.size.md,
    },
    cancelBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing['3'],
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
    },
    cancelBtnText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.sm,
    },
});
