import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Clock, Copy, Share2 } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';

// ── Helpers ──────────────────────────────────────────────

function getRemainingTime(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}min restantes`;
    return `${minutes}min restantes`;
}

// ── Props ────────────────────────────────────────────────

type InviteSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    code: string;
    expiresAt: string;
}>;

// ── Component ────────────────────────────────────────────

export function InviteSheet({ visible, onClose, code, expiresAt }: InviteSheetProps) {
    const { colors } = useTheme();
    const [countdown, setCountdown] = useState(() => getRemainingTime(expiresAt));
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Countdown tick
    useEffect(() => {
        if (!visible) return;

        setCountdown(getRemainingTime(expiresAt));
        const interval = setInterval(() => {
            setCountdown(getRemainingTime(expiresAt));
        }, 60_000);

        return () => clearInterval(interval);
    }, [visible, expiresAt]);

    // Reset copied state when sheet closes
    useEffect(() => {
        if (!visible) setCopied(false);
    }, [visible]);

    // Cleanup timer
    useEffect(() => {
        return () => {
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
        };
    }, []);

    const handleCopy = useCallback(async () => {
        await Clipboard.setStringAsync(code);
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }, [code]);

    const handleShare = useCallback(async () => {
        try {
            await Share.share({
                message: `Use o código ${code} para entrar na nossa família no Trofinho!`,
            });
        } catch {
            // User cancelled share — no-op
        }
    }, [code]);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            closeLabel="Fechar convite"
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text.primary }]}>
                    Código de Convite
                </Text>
            </View>

            <View style={styles.body}>
                {/* Code display */}
                <View
                    style={[
                        styles.codeCard,
                        {
                            backgroundColor: withAlpha(colors.brand.vivid, 0.08),
                            borderColor: withAlpha(colors.brand.vivid, 0.2),
                        },
                    ]}
                >
                    <Text style={[styles.codeLabel, { color: colors.text.secondary }]}>
                        Compartilhe este código
                    </Text>

                    <Text
                        style={[styles.codeText, { color: colors.text.primary }]}
                        accessibilityLabel={`Código de convite: ${code}`}
                        selectable
                    >
                        {code}
                    </Text>

                    <View style={styles.countdownRow}>
                        <Clock size={12} color={colors.text.secondary} strokeWidth={2} />
                        <Text style={[styles.countdownText, { color: colors.text.secondary }]}>
                            {countdown}
                        </Text>
                    </View>
                </View>

                {/* Action buttons */}
                <View style={styles.actions}>
                    <Pressable
                        style={({ pressed }) => [
                            styles.actionBtn,
                            {
                                backgroundColor: pressed
                                    ? withAlpha(colors.brand.vivid, 0.15)
                                    : colors.bg.elevated,
                                borderColor: colors.border.subtle,
                            },
                        ]}
                        onPress={handleCopy}
                        accessibilityRole="button"
                        accessibilityLabel="Copiar código"
                    >
                        <Copy size={16} color={colors.text.primary} strokeWidth={2} />
                        <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>
                            {copied ? 'Copiado!' : 'Copiar código'}
                        </Text>
                    </Pressable>

                    <Pressable
                        style={({ pressed }) => [
                            styles.actionBtn,
                            {
                                backgroundColor: pressed
                                    ? withAlpha(colors.brand.vivid, 0.15)
                                    : colors.bg.elevated,
                                borderColor: colors.border.subtle,
                            },
                        ]}
                        onPress={handleShare}
                        accessibilityRole="button"
                        accessibilityLabel="Compartilhar código"
                    >
                        <Share2 size={16} color={colors.text.primary} strokeWidth={2} />
                        <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>
                            Compartilhar
                        </Text>
                    </Pressable>
                </View>

                <Text style={[styles.hint, { color: colors.text.secondary }]}>
                    Envie este código para a pessoa que deseja convidar como administrador da família.
                </Text>
            </View>
        </BottomSheetModal>
    );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing['4'],
    },
    title: {
        fontSize: typography.size.lg,
        fontFamily: typography.family.bold,
    },
    body: {
        gap: spacing['4'],
        paddingBottom: spacing['2'],
    },

    // Code card
    codeCard: {
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        padding: spacing['4'],
        alignItems: 'center',
        gap: spacing['2'],
    },
    codeLabel: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    codeText: {
        fontFamily: typography.family.extrabold,
        fontSize: typography.size['4xl'],
        letterSpacing: 6,
    },
    countdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1'],
    },
    countdownText: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.xs,
    },

    // Actions
    actions: {
        flexDirection: 'row',
        gap: spacing['2'],
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['1.5'],
        paddingVertical: spacing['3'],
        borderRadius: radii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
    },
    actionBtnText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.sm,
    },

    // Hint
    hint: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.xs,
        textAlign: 'center',
        lineHeight: typography.lineHeight.xs,
    },
});
