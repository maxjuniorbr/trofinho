import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import {
    Clock,
    Copy,
    Share2,
    Shield,
    Trash2,
    UserPlus,
    X,
} from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography, withAlpha } from '@/constants/theme';
import type { AdminInvite, FamilyAdmin } from '../../../lib/admin-invite';

// ── Props ────────────────────────────────────────────────

type AdminSectionProps = Readonly<{
    admins: FamilyAdmin[];
    currentUserId: string | undefined;
    pendingInvite: AdminInvite | null;
    onGenerateInvite: () => void;
    onCancelInvite: (inviteId: string) => void;
    onRemoveAdmin: (admin: FamilyAdmin) => void;
    generatingInvite?: boolean;
    cancellingInvite?: boolean;
}>;

// ── Countdown helper ─────────────────────────────────────

function getRemainingTime(expiresAt: string): string {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return 'Expirado';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) return `${hours}h ${minutes}min restantes`;
    return `${minutes}min restantes`;
}

// ── Component ────────────────────────────────────────────

export function AdminSection({
    admins,
    currentUserId,
    pendingInvite,
    onGenerateInvite,
    onCancelInvite,
    onRemoveAdmin,
    generatingInvite = false,
    cancellingInvite = false,
}: AdminSectionProps) {
    const { colors } = useTheme();
    const [countdown, setCountdown] = useState(() =>
        pendingInvite ? getRemainingTime(pendingInvite.expires_at) : '',
    );
    const [copied, setCopied] = useState(false);
    const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const hasTwoAdmins = admins.length >= 2;
    const showInviteButton = !hasTwoAdmins && !pendingInvite;

    // Countdown tick
    useEffect(() => {
        if (!pendingInvite) return;

        setCountdown(getRemainingTime(pendingInvite.expires_at));
        const interval = setInterval(() => {
            setCountdown(getRemainingTime(pendingInvite.expires_at));
        }, 60_000);

        return () => clearInterval(interval);
    }, [pendingInvite]);

    // Cleanup copied timer
    useEffect(() => {
        return () => {
            if (copiedTimer.current) clearTimeout(copiedTimer.current);
        };
    }, []);

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
        } catch {
            // User cancelled share — no-op
        }
    }, [pendingInvite]);

    return (
        <View>
            {/* Title */}
            <View style={styles.titleRow}>
                <Shield size={16} color={colors.text.secondary} strokeWidth={2} />
                <Text style={[styles.title, { color: colors.text.secondary }]}>
                    Administradores
                </Text>
            </View>

            <View
                style={[
                    styles.card,
                    { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle },
                ]}
            >

                {/* Admin list */}
                {admins.map((admin, index) => {
                    const isCurrentUser = admin.id === currentUserId;
                    const isLast = index === admins.length - 1 && !pendingInvite && !showInviteButton;

                    return (
                        <View
                            key={admin.id}
                            style={[
                                styles.adminRow,
                                !isLast && { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
                            ]}
                        >
                            <View style={styles.adminInfo}>
                                <Text style={[styles.adminName, { color: colors.text.primary }]}>
                                    {admin.nome}
                                    {isCurrentUser ? ' (você)' : ''}
                                </Text>
                                {admin.email ? (
                                    <Text style={[styles.adminEmail, { color: colors.text.secondary }]}>
                                        {admin.email}
                                    </Text>
                                ) : null}
                            </View>

                            {!isCurrentUser && (
                                <Pressable
                                    onPress={() => onRemoveAdmin(admin)}
                                    hitSlop={8}
                                    accessibilityRole="button"
                                    accessibilityLabel={`Remover ${admin.nome}`}
                                >
                                    <Trash2 size={16} color={colors.semantic.error} strokeWidth={2} />
                                </Pressable>
                            )}
                        </View>
                    );
                })}

                {/* Pending invite */}
                {pendingInvite && (
                    <View style={styles.inviteSection}>
                        <View
                            style={[
                                styles.inviteCard,
                                {
                                    backgroundColor: withAlpha(colors.brand.vivid, 0.08),
                                    borderColor: withAlpha(colors.brand.vivid, 0.2),
                                },
                            ]}
                        >
                            <Text style={[styles.inviteLabel, { color: colors.text.secondary }]}>
                                Convite pendente
                            </Text>

                            <Text
                                style={[styles.inviteCode, { color: colors.text.primary }]}
                                accessibilityLabel={`Código de convite: ${pendingInvite.codigo}`}
                                selectable
                            >
                                {pendingInvite.codigo}
                            </Text>

                            <View style={styles.countdownRow}>
                                <Clock size={12} color={colors.text.secondary} strokeWidth={2} />
                                <Text style={[styles.countdownText, { color: colors.text.secondary }]}>
                                    {countdown}
                                </Text>
                            </View>

                            <View style={styles.inviteActions}>
                                <Pressable
                                    style={[
                                        styles.actionBtn,
                                        { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
                                    ]}
                                    onPress={handleCopy}
                                    accessibilityRole="button"
                                    accessibilityLabel="Copiar código"
                                >
                                    <Copy size={14} color={colors.text.primary} strokeWidth={2} />
                                    <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>
                                        {copied ? 'Copiado!' : 'Copiar'}
                                    </Text>
                                </Pressable>

                                <Pressable
                                    style={[
                                        styles.actionBtn,
                                        { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
                                    ]}
                                    onPress={handleShare}
                                    accessibilityRole="button"
                                    accessibilityLabel="Compartilhar código"
                                >
                                    <Share2 size={14} color={colors.text.primary} strokeWidth={2} />
                                    <Text style={[styles.actionBtnText, { color: colors.text.primary }]}>
                                        Compartilhar
                                    </Text>
                                </Pressable>
                            </View>

                            <Pressable
                                style={[
                                    styles.cancelBtn,
                                    { borderColor: withAlpha(colors.semantic.error, 0.3) },
                                ]}
                                onPress={() => onCancelInvite(pendingInvite.id)}
                                disabled={cancellingInvite}
                                accessibilityRole="button"
                                accessibilityLabel="Cancelar convite"
                            >
                                <X size={14} color={colors.semantic.error} strokeWidth={2} />
                                <Text style={[styles.cancelBtnText, { color: colors.semantic.error }]}>
                                    {cancellingInvite ? 'Cancelando…' : 'Cancelar convite'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                )}

                {/* Invite button */}
                {showInviteButton && (
                    <Pressable
                        style={({ pressed }) => [
                            styles.inviteBtn,
                            {
                                backgroundColor: pressed
                                    ? withAlpha(colors.brand.vivid, 0.15)
                                    : withAlpha(colors.brand.vivid, 0.08),
                            },
                        ]}
                        onPress={onGenerateInvite}
                        disabled={generatingInvite}
                        accessibilityRole="button"
                        accessibilityLabel="Convidar administrador"
                    >
                        <UserPlus size={16} color={colors.brand.dim} strokeWidth={2} />
                        <Text style={[styles.inviteBtnText, { color: colors.brand.dim }]}>
                            {generatingInvite ? 'Gerando convite…' : 'Convidar administrador'}
                        </Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
    card: {
        borderRadius: radii.xl,
        borderCurve: 'continuous',
        borderWidth: 1,
        padding: spacing['4'],
        gap: spacing['1'],
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing['1.5'],
        paddingHorizontal: spacing['1'],
        marginBottom: spacing['2'],
    },
    title: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    // Admin rows
    adminRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing['3'],
    },
    adminInfo: {
        flex: 1,
        gap: 2,
    },
    adminName: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.sm,
    },
    adminEmail: {
        fontFamily: typography.family.medium,
        fontSize: typography.size.xs,
    },

    // Pending invite
    inviteSection: {
        paddingTop: spacing['2'],
    },
    inviteCard: {
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        borderWidth: 1,
        padding: spacing['3'],
        alignItems: 'center',
        gap: spacing['2'],
    },
    inviteLabel: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.xs,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    inviteCode: {
        fontFamily: typography.family.extrabold,
        fontSize: typography.size['2xl'],
        letterSpacing: 4,
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
    inviteActions: {
        flexDirection: 'row',
        gap: spacing['2'],
        width: '100%',
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['1.5'],
        paddingVertical: spacing['2'],
        borderRadius: radii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
    },
    actionBtnText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.sm,
    },
    cancelBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['1'],
        paddingVertical: spacing['2'],
        width: '100%',
        borderRadius: radii.md,
        borderCurve: 'continuous',
        borderWidth: 1,
    },
    cancelBtnText: {
        fontFamily: typography.family.semibold,
        fontSize: typography.size.sm,
    },

    // Invite button
    inviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing['2'],
        paddingVertical: spacing['3'],
        borderRadius: radii.lg,
        borderCurve: 'continuous',
        marginTop: spacing['2'],
    },
    inviteBtnText: {
        fontFamily: typography.family.bold,
        fontSize: typography.size.sm,
    },
});
