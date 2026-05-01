import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Check, Clock, Copy, Share2, Ticket } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { InlineMessage } from '@/components/ui/inline-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import { externalBrandColors, staticTextColors } from '@/constants/colors';

// ── Types ────────────────────────────────────────────────

export type ChildInvite = {
    codigo: string;
    nome_filho: string;
    expira_em: string;
};

type ChildInviteSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    invite: ChildInvite | null;
}>;

// ── Helpers ──────────────────────────────────────────────

function getRemainingTime(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirado';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h restantes`;
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min restantes`;
    return `${minutes}min restantes`;
}

function buildWhatsAppUrl(code: string, childName: string): string {
    const message = `Olá! Criei uma conta para ${childName} no Trofinho. Use este código para vincular: ${code}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ── Component ────────────────────────────────────────────

export function ChildInviteSheet({ visible, onClose, invite }: ChildInviteSheetProps) {
    const { colors } = useTheme();
    const s = makeStyles(colors);

    // Copy state
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(
        () => () => {
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
        },
        [],
    );
    useEffect(() => {
        if (!visible) setCopied(false);
    }, [visible]);

    // Countdown
    const [countdown, setCountdown] = useState('');
    useEffect(() => {
        if (!invite || !visible) return;
        setCountdown(getRemainingTime(invite.expira_em));
        const interval = setInterval(() => {
            setCountdown(getRemainingTime(invite.expira_em));
        }, 60_000);
        return () => clearInterval(interval);
    }, [invite, visible]);

    const handleCopy = useCallback(async () => {
        if (!invite) return;
        await Clipboard.setStringAsync(invite.codigo);
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }, [invite]);

    const handleShare = useCallback(async () => {
        if (!invite) return;
        try {
            await Share.share({
                message: `Use o código ${invite.codigo} para vincular a conta de ${invite.nome_filho} no Trofinho!`,
            });
        } catch {
            /* user cancelled */
        }
    }, [invite]);

    const handleWhatsApp = useCallback(async () => {
        if (!invite) return;
        const url = buildWhatsAppUrl(invite.codigo, invite.nome_filho);
        try {
            await Linking.openURL(url);
        } catch {
            await handleShare();
        }
    }, [invite, handleShare]);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            sheetStyle={s.sheet}
            closeLabel="Fechar convite"
        >
            {/* Header */}
            <View style={s.header}>
                <View style={[s.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
                    <Ticket size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
                </View>
                <View style={s.headerText}>
                    <Text style={[s.title, { color: colors.text.primary }]}>Convite gerado</Text>
                    <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                        Compartilhe o código com {invite?.nome_filho ?? 'o filho'} para vincular a conta
                    </Text>
                </View>
            </View>

            {invite ? (
                <View
                    style={[
                        s.inviteCard,
                        { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                    ]}
                >
                    <View
                        style={[
                            s.inviteHeader,
                            {
                                backgroundColor: withAlpha(colors.brand.vivid, 0.1),
                                borderColor: colors.border.subtle,
                            },
                        ]}
                    >
                        <Text style={[s.inviteHeaderText, { color: colors.brand.vivid }]}>
                            Código de convite
                        </Text>
                    </View>
                    <View style={s.inviteBody}>
                        <View style={s.codeRow}>
                            <View style={[s.codeBox, { backgroundColor: colors.bg.muted }]}>
                                <Text
                                    style={[s.codeText, { color: colors.text.primary }]}
                                    accessibilityLabel={`Código de convite: ${invite.codigo}`}
                                    selectable
                                >
                                    {invite.codigo}
                                </Text>
                            </View>
                            <Pressable
                                style={[
                                    s.copyBtn,
                                    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                                ]}
                                onPress={handleCopy}
                                accessibilityRole="button"
                                accessibilityLabel="Copiar código"
                            >
                                {copied ? (
                                    <Check size={16} color={colors.semantic.success} strokeWidth={2} />
                                ) : (
                                    <Copy size={16} color={colors.text.primary} strokeWidth={2} />
                                )}
                            </Pressable>
                        </View>

                        <View style={s.countdownRow}>
                            <Clock size={12} color={colors.text.secondary} strokeWidth={2} />
                            <Text style={[s.countdownText, { color: colors.text.secondary }]}>{countdown}</Text>
                        </View>

                        <InlineMessage
                            message={`O filho deve abrir o Trofinho, inserir o código "${invite.codigo}" e fazer login com Google para vincular a conta.`}
                            variant="info"
                        />

                        {/* WhatsApp share */}
                        <Pressable
                            style={s.whatsappBtn}
                            onPress={handleWhatsApp}
                            accessibilityRole="button"
                            accessibilityLabel="Enviar pelo WhatsApp"
                        >
                            <Share2 size={16} color={staticTextColors.inverse} strokeWidth={2} />
                            <Text style={s.whatsappBtnText}>Enviar pelo WhatsApp</Text>
                        </Pressable>
                    </View>
                </View>
            ) : null}
        </BottomSheetModal>
    );
}

// ── Styles ───────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sheet: { maxHeight: '85%' },
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
        title: { fontSize: typography.size.md, fontFamily: typography.family.bold },
        subtitle: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },

        // Invite card
        inviteCard: {
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
            overflow: 'hidden',
        },
        inviteHeader: {
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            borderBottomWidth: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['2'],
        },
        inviteHeaderText: {
            fontFamily: typography.family.extrabold,
            fontSize: typography.size.xs,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
        },
        inviteBody: { padding: spacing['4'], gap: spacing['3'] },
        codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
        codeBox: {
            flex: 1,
            paddingVertical: spacing['3'],
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            alignItems: 'center',
        },
        codeText: {
            fontFamily: typography.family.extrabold,
            fontSize: typography.size['2xl'],
            letterSpacing: 6,
        },
        copyBtn: {
            width: 48,
            height: 48,
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
        },
        countdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1'] },
        countdownText: { fontFamily: typography.family.medium, fontSize: typography.size.xxs },

        // WhatsApp
        whatsappBtn: {
            height: 48,
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            backgroundColor: externalBrandColors.whatsapp,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
        },
        whatsappBtnText: {
            fontFamily: typography.family.extrabold,
            fontSize: typography.size.sm,
            color: staticTextColors.inverse,
        },
    });
}
