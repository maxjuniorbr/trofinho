import { StyleSheet, Text, View } from 'react-native';
import { type LucideIcon } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

type IconVariant = 'danger' | 'warning' | 'info';

type ConfirmSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    /** Lucide icon to display at the top. */
    icon: LucideIcon;
    /** Controls the icon container background tint. Default: 'warning'. */
    iconVariant?: IconVariant;
    title: string;
    description: string;
    confirmLabel: string;
    loadingLabel?: string;
    /** Button variant for the confirm action. Default: 'danger'. */
    confirmVariant?: 'danger' | 'primary';
    cancelLabel?: string;
    onConfirm: () => void;
    loading?: boolean;
    /** Accessibility label for the sheet close handle. */
    closeLabel?: string;
}>;

export function ConfirmSheet({
    visible,
    onClose,
    icon: Icon,
    iconVariant = 'warning',
    title,
    description,
    confirmLabel,
    loadingLabel,
    confirmVariant = 'danger',
    cancelLabel = 'Continuar',
    onConfirm,
    loading = false,
    closeLabel,
}: ConfirmSheetProps) {
    const { colors } = useTheme();

    const iconColor = resolveIconColor(iconVariant, colors);
    const iconBg = withAlpha(iconColor, 0.12);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            closeLabel={closeLabel ?? `Fechar ${title}`}
        >
            <View style={styles.body}>
                <View style={[styles.iconBox, { backgroundColor: iconBg }]}>
                    <Icon size={24} color={iconColor} strokeWidth={2} />
                </View>

                <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>

                <Text style={[styles.description, { color: colors.text.secondary }]}>{description}</Text>

                <View style={styles.actions}>
                    <Button
                        label={confirmLabel}
                        loadingLabel={loadingLabel}
                        variant={confirmVariant}
                        size="lg"
                        loading={loading}
                        onPress={onConfirm}
                        accessibilityLabel={loading ? (loadingLabel ?? confirmLabel) : confirmLabel}
                        accessibilityState={{ busy: loading }}
                    />
                    <Button
                        label={cancelLabel}
                        variant="secondary"
                        size="lg"
                        onPress={onClose}
                        disabled={loading}
                        accessibilityLabel={cancelLabel}
                    />
                </View>
            </View>
        </BottomSheetModal>
    );
}

function resolveIconColor(
    variant: IconVariant,
    colors: ReturnType<typeof useTheme>['colors'],
): string {
    switch (variant) {
        case 'danger':
            return colors.semantic.error;
        case 'warning':
            return colors.semantic.warning;
        case 'info':
            return colors.accent.admin;
    }
}

const styles = StyleSheet.create({
    body: {
        alignItems: 'center',
        gap: spacing['3'],
        paddingBottom: spacing['2'],
    },
    iconBox: {
        width: 56,
        height: 56,
        borderRadius: radii.lg,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing['1'],
    },
    title: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.lg,
        lineHeight: typography.lineHeight.lg,
        textAlign: 'center',
    },
    description: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.sm,
        lineHeight: typography.lineHeight.sm,
        textAlign: 'center',
    },
    actions: {
        width: '100%',
        gap: spacing['4'],
        marginTop: spacing['2'],
    },
});
