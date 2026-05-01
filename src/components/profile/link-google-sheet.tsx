import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Link2 } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { InlineMessage } from '@/components/ui/inline-message';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { linkGoogleIdentity } from '@lib/auth';

type LinkGoogleSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    onLinked: () => void;
}>;

const AUTO_CLOSE_MS = 1500;

/**
 * Bottom sheet that guides the user through linking their Google account.
 * Calls `linkGoogleIdentity()` and shows success/error feedback.
 */
export function LinkGoogleSheet({ visible, onClose, onLinked }: LinkGoogleSheetProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearCloseTimer = useCallback(() => {
        if (closeTimerRef.current) {
            clearTimeout(closeTimerRef.current);
            closeTimerRef.current = null;
        }
    }, []);

    useEffect(() => clearCloseTimer, [clearCloseTimer]);

    const resetState = useCallback(() => {
        clearCloseTimer();
        setLoading(false);
        setError(null);
        setSuccess(false);
    }, [clearCloseTimer]);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [resetState, onClose]);

    const handleLink = useCallback(async () => {
        setLoading(true);
        setError(null);

        const result = await linkGoogleIdentity();

        setLoading(false);

        if (result.error) {
            setError(result.error);
            return;
        }

        setSuccess(true);
        clearCloseTimer();
        closeTimerRef.current = setTimeout(() => {
            handleClose();
            onLinked();
        }, AUTO_CLOSE_MS);
    }, [clearCloseTimer, handleClose, onLinked]);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={handleClose}
            sheetStyle={styles.sheet}
            closeLabel="Fechar vinculação de conta Google"
        >
            {/* Header */}
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
                    <Link2 size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
                </View>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>
                        Vincular conta Google
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Conecte sua conta Google para login rápido e seguro
                    </Text>
                </View>
            </View>

            {success ? (
                <View style={styles.successContainer}>
                    <View style={[styles.successIcon, { backgroundColor: colors.semantic.successBg }]}>
                        <Check size={28} color={colors.semantic.success} strokeWidth={2.4} />
                    </View>
                    <Text style={[styles.successTitle, { color: colors.text.primary }]}>
                        Conta vinculada!
                    </Text>
                    <Text style={[styles.successDesc, { color: colors.text.secondary }]}>
                        Agora você pode entrar com sua conta Google.
                    </Text>
                </View>
            ) : (
                <View style={styles.content}>
                    {error ? <InlineMessage message={error} variant="error" /> : null}

                    <GoogleSignInButton
                        onPress={handleLink}
                        loading={loading}
                        label="Vincular com Google"
                    />
                </View>
            )}
        </BottomSheetModal>
    );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        sheet: {
            maxHeight: '70%',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing['3'],
            marginBottom: spacing['5'],
        },
        headerIcon: {
            width: 40,
            height: 40,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
        },
        headerText: {
            flex: 1,
            gap: spacing['0.5'],
        },
        title: {
            fontSize: typography.size.md,
            fontFamily: typography.family.bold,
        },
        subtitle: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.semibold,
        },
        content: {
            gap: spacing['4'],
            paddingBottom: spacing['4'],
        },
        successContainer: {
            paddingVertical: spacing['8'],
            alignItems: 'center',
            gap: spacing['3'],
        },
        successIcon: {
            width: 56,
            height: 56,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
        },
        successTitle: {
            fontSize: typography.size.md,
            fontFamily: typography.family.bold,
        },
        successDesc: {
            fontSize: typography.size.sm,
            fontFamily: typography.family.medium,
            textAlign: 'center',
        },
    });
}
