import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
    Check,
    Clock,
    Copy,
    Share2,
    ShieldCheck,
    Trash2,
    UserPlus,
    Users,
} from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Avatar } from '@/components/ui/avatar';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import { externalBrandColors, staticTextColors } from '@/constants/colors';
import type { AdminInvite, FamilyAdmin } from '../../../lib/admin-invite';

const MAX_ADMINS = 2;

// ── Helpers ──────────────────────────────────────────────

function getRemainingTime(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirado';
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}min restantes`;
    return `${minutes}min restantes`;
}

function buildWhatsAppUrl(code: string): string {
    const message = `Olá! Quero te adicionar como administrador no Trofinho da nossa família. Use este código para aceitar o convite: ${code}`;
    return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ── Props ────────────────────────────────────────────────

type AdminManagementSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    admins: FamilyAdmin[];
    currentUserId: string | undefined;
    pendingInvite: AdminInvite | null;
    onGenerateInvite: () => void;
    onCancelInvite: (inviteId: string) => void;
    onRemoveAdmin: (admin: FamilyAdmin) => void;
    generatingInvite?: boolean;
    cancellingInvite?: boolean;
}>;

// ── Component ────────────────────────────────────────────

export function AdminManagementSheet({
    visible,
    onClose,
    admins,
    currentUserId,
    pendingInvite,
    onGenerateInvite,
    onCancelInvite,
    onRemoveAdmin,
    generatingInvite = false,
    cancellingInvite = false,
}: AdminManagementSheetProps) {
    const { colors } = useTheme();
    const s = makeStyles(colors);

    const canInvite = admins.length < MAX_ADMINS;
    const remainingSlots = MAX_ADMINS - admins.length;

    // Countdown
    const [countdown, setCountdown] = useState('');
    useEffect(() => {
        if (!pendingInvite || !visible) return;
        setCountdown(getRemainingTime(pendingInvite.expires_at));
        const interval = setInterval(() => {
            setCountdown(getRemainingTime(pendingInvite.expires_at));
        }, 60_000);
        return () => clearInterval(interval);
    }, [pendingInvite, visible]);

    // Copy
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => { if (copiedTimer.current) clearTimeout(copiedTimer.current); }, []);
    useEffect(() => { if (!visible) setCopied(false); }, [visible]);

    const handleCopy = useCallback(async () => {
        if (!pendingInvite) return;
        await Clipboard.setStringAsync(pendingInvite.codigo);
        setCopied(true);
        if (copiedTimer.current) clearTimeout(copiedTimer.current);
        copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    }, [pendingInvite]);

    const handleShare = useCallback(async () => {
        if (!pendingInvite) return;
        try {
            await Share.share({
                message: `Use o código ${pendingInvite.codigo} para entrar na nossa família no Trofinho!`,
            });
        } catch { /* user cancelled */ }
    }, [pendingInvite]);

    const handleWhatsApp = useCallback(async () => {
        if (!pendingInvite) return;
        const url = buildWhatsAppUrl(pendingInvite.codigo);
        try { await Linking.openURL(url); } catch { /* WhatsApp not installed — fallback to share */ await handleShare(); }
    }, [pendingInvite, handleShare]);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            sheetStyle={s.sheet}
            closeLabel="Fechar administradores"
        >
            {/* Header */}
            <View style={s.header}>
                <View style={[s.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
                    <Users size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
                </View>
                <View style={s.headerText}>
                    <Text style={[s.title, { color: colors.text.primary }]}>Administradores</Text>
                    <Text style={[s.subtitle, { color: colors.text.secondary }]}>
                        Até {MAX_ADMINS} responsáveis podem gerenciar a família
                    </Text>
                </View>
            </View>

            {/* Admin list */}
            <View style={s.adminList}>
                {admins.map((admin) => {
                    const isCurrentUser = admin.id === currentUserId;
                    return (
                        <View
                            key={admin.id}
                            style={[s.adminCard, { backgroundColor: colors.bg.muted, borderColor: colors.border.subtle }]}
                        >
                            <Avatar name={admin.nome} size={40} imageUri={admin.avatarUrl} />
                            <View style={s.adminInfo}>
                                <View style={s.adminNameRow}>
                                    <Text style={[s.adminName, { color: colors.text.primary }]} numberOfLines={1}>
                                        {admin.nome}
                                    </Text>
                                    {isCurrentUser && (
                                        <View style={[s.youBadge, { backgroundColor: withAlpha(colors.brand.vivid, 0.15) }]}>
                                            <Text style={[s.youBadgeText, { color: colors.brand.vivid }]}>Você</Text>
                                        </View>
                                    )}
                                </View>
                                {admin.email ? (
                                    <Text style={[s.adminEmail, { color: colors.text.secondary }]} numberOfLines={1}>
                                        {admin.email}
                                    </Text>
                                ) : null}
                            </View>
                            {!isCurrentUser && (
                                <Pressable
                                    onPress={() => onRemoveAdmin(admin)}
                                    style={[s.removeBtn, { backgroundColor: withAlpha(colors.semantic.error, 0.1) }]}
                                    hitSlop={4}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remover ${admin.nome}`}
                                >
                                    <Trash2 size={16} color={colors.semantic.error} strokeWidth={2} />
                                </Pressable>
                            )}
                        </View>
                    );
                })}
            </View>

            {/* Invite section */}
            {!canInvite ? (
                /* Limit reached */
                <View style={[s.limitCard, { backgroundColor: colors.bg.muted, borderColor: colors.border.subtle }]}>
                    <ShieldCheck size={20} color={colors.brand.vivid} strokeWidth={2} />
                    <View style={s.limitInfo}>
                        <Text style={[s.limitTitle, { color: colors.text.primary }]}>Limite atingido</Text>
                        <Text style={[s.limitDesc, { color: colors.text.secondary }]}>
                            Sua família já tem {MAX_ADMINS} administradores. Remova um para convidar outro.
                        </Text>
                    </View>
                </View>
            ) : pendingInvite ? (
                /* Active invite */
                <View style={[s.inviteCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                    <View style={[s.inviteHeader, { backgroundColor: withAlpha(colors.brand.vivid, 0.1), borderColor: colors.border.subtle }]}>
                        <Text style={[s.inviteHeaderText, { color: colors.brand.vivid }]}>
                            Convite ativo
                        </Text>
                    </View>
                    <View style={s.inviteBody}>
                        <Text style={[s.codeLabel, { color: colors.text.secondary }]}>Código</Text>
                        <View style={s.codeRow}>
                            <View style={[s.codeBox, { backgroundColor: colors.bg.muted }]}>
                                <Text
                                    style={[s.codeText, { color: colors.text.primary }]}
                                    accessibilityLabel={`Código de convite: ${pendingInvite.codigo}`}
                                    selectable
                                >
                                    {pendingInvite.codigo}
                                </Text>
                            </View>
                            <Pressable
                                style={[s.copyBtn, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}
                                onPress={handleCopy}
                                accessibilityRole="button"
                                accessibilityLabel="Copiar código"
                            >
                                {copied
                                    ? <Check size={16} color={colors.semantic.success} strokeWidth={2} />
                                    : <Copy size={16} color={colors.text.primary} strokeWidth={2} />
                                }
                            </Pressable>
                        </View>
                        <View style={s.countdownRow}>
                            <Clock size={12} color={colors.text.secondary} strokeWidth={2} />
                            <Text style={[s.countdownText, { color: colors.text.secondary }]}>{countdown}</Text>
                        </View>

                        {/* WhatsApp share */}
                        <Pressable
                            style={s.whatsappBtn}
                            onPress={handleWhatsApp}
                            accessibilityRole="button"
                            accessibilityLabel="Enviar pelo WhatsApp"
                        >
                            <Share2 size={16} color="#FFFFFF" strokeWidth={2} />
                            <Text style={s.whatsappBtnText}>Enviar pelo WhatsApp</Text>
                        </Pressable>

                        {/* Cancel invite */}
                        <Pressable
                            style={[s.cancelBtn, { backgroundColor: withAlpha(colors.semantic.error, 0.1) }]}
                            onPress={() => onCancelInvite(pendingInvite.id)}
                            disabled={cancellingInvite}
                            accessibilityRole="button"
                            accessibilityLabel="Cancelar convite"
                        >
                            <Text style={[s.cancelBtnText, { color: colors.semantic.error }]}>
                                {cancellingInvite ? 'Cancelando…' : 'Cancelar convite'}
                            </Text>
                        </Pressable>
                    </View>
                </View>
            ) : (
                /* No invite — CTA */
                <View style={[s.ctaCard, { borderColor: colors.border.subtle, backgroundColor: withAlpha(colors.bg.muted, 0.3) }]}>
                    <View style={[s.ctaIcon, { backgroundColor: withAlpha(colors.brand.vivid, 0.15) }]}>
                        <UserPlus size={24} color={colors.brand.vivid} strokeWidth={2} />
                    </View>
                    <Text style={[s.ctaTitle, { color: colors.text.primary }]}>Convide outro responsável</Text>
                    <Text style={[s.ctaDesc, { color: colors.text.secondary }]}>
                        Gere um código único e envie pelo WhatsApp.{'\n'}
                        Resta {remainingSlots} vaga{remainingSlots > 1 ? 's' : ''} de admin.
                    </Text>
                    <Pressable
                        style={[s.ctaBtn, { backgroundColor: colors.brand.vivid }]}
                        onPress={onGenerateInvite}
                        disabled={generatingInvite}
                        accessibilityRole="button"
                        accessibilityLabel="Enviar convite"
                    >
                        <Text style={[s.ctaBtnText, { color: colors.text.inverse }]}>
                            {generatingInvite ? 'Gerando convite…' : 'Enviar convite'}
                        </Text>
                    </Pressable>
                </View>
            )}
        </BottomSheetModal>
    );
}

// ── Styles ───────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sheet: { maxHeight: '92%' },
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

        // Admin list
        adminList: { gap: spacing['2'], marginBottom: spacing['5'] },
        adminCard: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            padding: spacing['3'],
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
        },
        adminInfo: { flex: 1, minWidth: 0 },
        adminNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['1.5'] },
        adminName: { fontFamily: typography.family.bold, fontSize: typography.size.sm, flexShrink: 1 },
        youBadge: { paddingHorizontal: spacing['1.5'], paddingVertical: spacing['0.5'], borderRadius: radii.full },
        youBadgeText: { fontFamily: typography.family.extrabold, fontSize: typography.size.xxs, textTransform: 'uppercase', letterSpacing: 0.5 },
        adminEmail: { fontFamily: typography.family.medium, fontSize: typography.size.xxs, marginTop: 1 },
        removeBtn: {
            width: 36,
            height: 36,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
        },

        // Limit reached
        limitCard: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing['3'],
            padding: spacing['4'],
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
        },
        limitInfo: { flex: 1 },
        limitTitle: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
        limitDesc: { fontFamily: typography.family.medium, fontSize: typography.size.xs, lineHeight: typography.lineHeight.xs, marginTop: 2 },

        // Active invite card
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
        codeLabel: { fontFamily: typography.family.bold, fontSize: typography.size.xxs, textTransform: 'uppercase', letterSpacing: 0.5 },
        codeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing['2'] },
        codeBox: {
            flex: 1,
            paddingVertical: spacing['3'],
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            alignItems: 'center',
        },
        codeText: { fontFamily: typography.family.extrabold, fontSize: typography.size['2xl'], letterSpacing: 6 },
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
        whatsappBtnText: { fontFamily: typography.family.extrabold, fontSize: typography.size.sm, color: staticTextColors.inverse },

        // Cancel button
        cancelBtn: {
            height: 40,
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
        },
        cancelBtnText: { fontFamily: typography.family.bold, fontSize: typography.size.sm },

        // CTA (no invite)
        ctaCard: {
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderStyle: 'dashed',
            padding: spacing['5'],
            alignItems: 'center',
        },
        ctaIcon: {
            width: 48,
            height: 48,
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing['3'],
        },
        ctaTitle: { fontFamily: typography.family.bold, fontSize: typography.size.sm },
        ctaDesc: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            textAlign: 'center',
            lineHeight: typography.lineHeight.xs,
            marginTop: spacing['1'],
            marginBottom: spacing['4'],
        },
        ctaBtn: {
            width: '100%',
            height: 44,
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
        },
        ctaBtnText: { fontFamily: typography.family.extrabold, fontSize: typography.size.sm },
    });
}
