import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { Settings, X } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { hapticSuccess } from '@lib/haptics';

export type PiggyConfigSavePayload = Readonly<{
    rate: number;
    withdrawalRate: number;
    prazo: number;
}>;

type PiggyConfigSheetProps = Readonly<{
    visible: boolean;
    onClose: () => void;
    appreciationRate: number;
    withdrawalRate: number;
    prazoBloqueioDias: number;
    onSave: (values: PiggyConfigSavePayload) => Promise<void>;
    saving: boolean;
}>;

const sanitizeDigits = (value: string) => value.replace(/[^0-9]/g, '');
const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

export function PiggyConfigSheet({
    visible,
    onClose,
    appreciationRate,
    withdrawalRate,
    prazoBloqueioDias,
    onSave,
    saving,
}: PiggyConfigSheetProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const [rateText, setRateText] = useState(String(appreciationRate));
    const [withdrawalText, setWithdrawalText] = useState(String(withdrawalRate));
    const [prazoText, setPrazoText] = useState(String(prazoBloqueioDias));
    const [feedback, setFeedback] = useState<{
        message: string;
        variant: 'success' | 'error';
    } | null>(null);
    const visibleFeedback = useTransientMessage(feedback?.message ?? null);

    useEffect(() => {
        if (visible) {
            setRateText(String(appreciationRate));
            setWithdrawalText(String(withdrawalRate));
            setPrazoText(String(prazoBloqueioDias));
            setFeedback(null);
        }
    }, [visible, appreciationRate, withdrawalRate, prazoBloqueioDias]);

    const handleClose = useCallback(() => {
        setFeedback(null);
        onClose();
    }, [onClose]);

    const handleSave = useCallback(async () => {
        const rate = clamp(Number(rateText) || 0, 0, 100);
        const wd = clamp(Number(withdrawalText) || 0, 0, 50);
        const prazo = clamp(Math.round(Number(prazoText) || 0), 0, 365);
        try {
            await onSave({ rate, withdrawalRate: wd, prazo });
            hapticSuccess();
            setFeedback({ message: 'Configuração salva com sucesso.', variant: 'success' });
            onClose();
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Erro ao salvar configuração.';
            setFeedback({ message, variant: 'error' });
        }
    }, [rateText, withdrawalText, prazoText, onSave, onClose]);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
            <KeyboardAvoidingView
                style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
                <View style={[styles.sheet, { backgroundColor: colors.bg.surface }]}>
                    <View style={styles.header}>
                        <View style={styles.headerLeft}>
                            <View
                                style={[
                                    styles.headerIcon,
                                    { backgroundColor: colors.accent.adminBg },
                                ]}
                            >
                                <Settings
                                    size={20}
                                    color={colors.accent.adminDim}
                                    strokeWidth={2}
                                />
                            </View>
                            <View style={styles.headerText}>
                                <Text style={[styles.title, { color: colors.text.primary }]}>
                                    Configurar Cofrinho
                                </Text>
                                <Text style={[styles.subtitle, { color: colors.text.muted }]}>
                                    Regras só visíveis para você
                                </Text>
                            </View>
                        </View>
                        <Pressable
                            onPress={handleClose}
                            accessibilityRole="button"
                            accessibilityLabel="Fechar configuração do cofrinho"
                            style={[styles.closeBtn, { backgroundColor: colors.bg.muted }]}
                        >
                            <X size={16} color={colors.text.primary} strokeWidth={2} />
                        </Pressable>
                    </View>

                    <ScrollView
                        overScrollMode="never"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                    >
                        {visibleFeedback ? (
                            <View style={styles.feedbackRow}>
                                <InlineMessage
                                    message={visibleFeedback}
                                    variant={feedback?.variant ?? 'success'}
                                />
                            </View>
                        ) : null}

                        <NumberField
                            label="Taxa de rendimento (% ao mês)"
                            help="Quanto o cofrinho rende a cada mês"
                            value={rateText}
                            onChange={setRateText}
                            suffix="%"
                            colors={colors}
                            accessibilityLabel="Taxa de rendimento do cofrinho"
                        />
                        <NumberField
                            label="Taxa de saque antecipado (%)"
                            help="Cobrada quando o filho saca antes do prazo"
                            value={withdrawalText}
                            onChange={setWithdrawalText}
                            suffix="%"
                            colors={colors}
                            accessibilityLabel="Taxa de saque antecipado"
                        />
                        <NumberField
                            label="Prazo sem taxa (dias)"
                            help="Dias para o depósito poder ser sacado sem taxa"
                            value={prazoText}
                            onChange={setPrazoText}
                            suffix="dias"
                            colors={colors}
                            accessibilityLabel="Prazo sem taxa"
                        />

                        <Button
                            variant="primary"
                            label="Salvar configuração"
                            loading={saving}
                            loadingLabel="Salvando…"
                            onPress={handleSave}
                            accessibilityLabel="Salvar configuração do cofrinho"
                        />
                    </ScrollView>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

type NumberFieldProps = Readonly<{
    label: string;
    help: string;
    value: string;
    onChange: (next: string) => void;
    suffix: string;
    colors: ThemeColors;
    accessibilityLabel: string;
}>;

function NumberField({
    label,
    help,
    value,
    onChange,
    suffix,
    colors,
    accessibilityLabel,
}: NumberFieldProps) {
    const styles = useMemo(() => makeFieldStyles(), []);
    return (
        <View style={styles.wrapper}>
            <Text style={[styles.label, { color: colors.text.muted }]}>{label}</Text>
            <View style={styles.inputWrapper}>
                <TextInput
                    value={value}
                    onChangeText={(next) => onChange(sanitizeDigits(next))}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    accessibilityLabel={accessibilityLabel}
                    style={[
                        styles.input,
                        {
                            backgroundColor: colors.bg.muted,
                            color: colors.text.primary,
                        },
                    ]}
                />
                <Text style={[styles.suffix, { color: colors.text.muted }]}>{suffix}</Text>
            </View>
            <Text style={[styles.help, { color: colors.text.muted }]}>{help}</Text>
        </View>
    );
}

function makeStyles(_colors: ThemeColors) {
    return StyleSheet.create({
        overlay: { flex: 1, justifyContent: 'flex-end' },
        sheet: {
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing['6'],
            paddingBottom: spacing['12'],
            maxHeight: '85%',
        },
        header: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: spacing['5'],
            gap: spacing['3'],
        },
        headerLeft: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            flex: 1,
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
            fontFamily: typography.family.extrabold,
        },
        subtitle: {
            fontSize: typography.size.xs,
            fontFamily: typography.family.medium,
        },
        closeBtn: {
            width: 36,
            height: 36,
            borderRadius: radii.full,
            alignItems: 'center',
            justifyContent: 'center',
        },
        content: {
            gap: spacing['4'],
            paddingBottom: spacing['4'],
        },
        feedbackRow: {
            marginBottom: spacing['1'],
        },
    });
}

function makeFieldStyles() {
    return StyleSheet.create({
        wrapper: { gap: spacing['1'] },
        label: {
            fontSize: typography.size.xxs,
            fontFamily: typography.family.bold,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
        },
        inputWrapper: {
            position: 'relative',
            justifyContent: 'center',
        },
        input: {
            borderRadius: radii.lg,
            paddingHorizontal: spacing['4'],
            paddingRight: spacing['12'],
            paddingVertical: spacing['3'],
            fontSize: typography.size.sm,
            fontFamily: typography.family.semibold,
            minHeight: 48,
        },
        suffix: {
            position: 'absolute',
            right: spacing['4'],
            fontSize: typography.size.xxs,
            fontFamily: typography.family.bold,
        },
        help: {
            fontSize: typography.size.xxs,
            fontFamily: typography.family.medium,
            marginTop: spacing['0.5'],
        },
    });
}
