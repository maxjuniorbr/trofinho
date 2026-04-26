import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArchiveRestore } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { Input } from '@/components/ui/input';
import { localizeRpcError } from '@lib/api-error';
import { PRIZE_EMOJIS, type Prize } from '@lib/prizes';
import {
    useCreatePrize,
    useUpdatePrize,
    useDeactivatePrize,
    useReactivatePrize,
} from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

type PrizeFormSheetProps = Readonly<{
    visible: boolean;
    mode: 'create' | 'edit';
    prize?: Prize | null;
    onClose: () => void;
    onSuccess?: (message: string) => void;
}>;

export function PrizeFormSheet({ visible, mode, prize, onClose, onSuccess }: PrizeFormSheetProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const createMutation = useCreatePrize();
    const updateMutation = useUpdatePrize();
    const deactivateMutation = useDeactivatePrize();
    const reactivateMutation = useReactivatePrize();
    const nameInputRef = useRef<TextInput>(null);

    const isEdit = mode === 'edit';

    const [emoji, setEmoji] = useState<string>(PRIZE_EMOJIS[0]);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [costStr, setCostStr] = useState('');
    const [stockStr, setStockStr] = useState('99');
    const [isActive, setIsActive] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const resetForm = useCallback(() => {
        setEmoji(PRIZE_EMOJIS[0]);
        setName('');
        setDescription('');
        setCostStr('');
        setStockStr('99');
        setIsActive(true);
        setError(null);
        createMutation.reset();
        updateMutation.reset();
    }, [createMutation, updateMutation]);

    useEffect(() => {
        if (!visible) return;
        if (isEdit && prize) {
            setEmoji(prize.emoji || PRIZE_EMOJIS[0]);
            setName(prize.nome);
            setDescription(prize.descricao ?? '');
            setCostStr(String(prize.custo_pontos));
            setStockStr(String(prize.estoque));
            setIsActive(prize.ativo);
            setError(null);
        } else if (!isEdit) {
            resetForm();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, isEdit, prize?.id]);

    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [resetForm, onClose]);

    const validate = (): { ok: boolean; cost: number; stock: number } => {
        setError(null);
        if (!name.trim()) {
            setError('Informe o nome do prêmio.');
            return { ok: false, cost: 0, stock: 0 };
        }
        const cost = Number.parseInt(costStr, 10);
        if (Number.isNaN(cost) || cost <= 0) {
            setError('Custo em pontos deve ser um número maior que zero.');
            return { ok: false, cost: 0, stock: 0 };
        }
        if (cost > 99999) {
            setError('O custo máximo é 99.999 pontos.');
            return { ok: false, cost, stock: 0 };
        }
        const stock = Number.parseInt(stockStr, 10);
        if (Number.isNaN(stock) || stock < 0) {
            setError('Estoque deve ser zero ou maior.');
            return { ok: false, cost, stock: 0 };
        }
        return { ok: true, cost, stock };
    };

    const handleCreate = () => {
        const { ok, cost, stock } = validate();
        if (!ok) return;

        createMutation.mutate(
            { nome: name.trim(), descricao: description.trim() || null, custo_pontos: cost, emoji, estoque: stock },
            {
                onSuccess: () => {
                    onSuccess?.('Prêmio criado com sucesso.');
                    handleClose();
                },
                onError: (err) => setError(localizeRpcError(err.message)),
            },
        );
    };

    const handleUpdate = () => {
        if (!prize) return;
        const { ok, cost, stock } = validate();
        if (!ok) return;

        updateMutation.mutate(
            {
                id: prize.id,
                input: {
                    nome: name.trim(),
                    descricao: description.trim() || null,
                    custo_pontos: cost,
                    emoji,
                    estoque: stock,
                    ativo: isActive,
                },
            },
            {
                onSuccess: (result) => {
                    if (result.pointsMessage) {
                        setError(result.pointsMessage);
                        return;
                    }
                    onSuccess?.('Prêmio atualizado com sucesso.');
                    handleClose();
                },
                onError: (err) => setError(localizeRpcError(err.message)),
            },
        );
    };

    const handleSubmit = () => {
        if (isEdit) handleUpdate();
        else handleCreate();
    };

    const isArchived = isEdit && !isActive;

    const handleArchive = () => {
        if (!prize) return;
        Alert.alert(
            'Arquivar prêmio?',
            'O prêmio não aparecerá para os filhos enquanto estiver arquivado.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Arquivar',
                    style: 'destructive',
                    onPress: () => {
                        deactivateMutation.mutate(prize.id, {
                            onSuccess: () => {
                                onSuccess?.('Prêmio arquivado.');
                                handleClose();
                            },
                            onError: (err) => setError(localizeRpcError(err.message)),
                        });
                    },
                },
            ],
        );
    };

    const handleUnarchive = () => {
        if (!prize) return;
        reactivateMutation.mutate(prize.id, {
            onSuccess: () => {
                onSuccess?.('Prêmio desarquivado.');
                handleClose();
            },
            onError: (err) => setError(localizeRpcError(err.message)),
        });
    };

    const focusInitialField = useCallback(() => {
        if (!isEdit) nameInputRef.current?.focus();
    }, [isEdit]);

    const isSaving = createMutation.isPending || updateMutation.isPending;
    const title = isEdit ? 'Editar Prêmio' : 'Novo Prêmio';
    const submitLabel = isEdit ? 'Salvar alterações' : 'Criar prêmio';

    return (
        <BottomSheetModal
            visible={visible}
            onClose={handleClose}
            onShow={focusInitialField}
            sheetStyle={styles.sheet}
            closeLabel={isEdit ? 'Fechar edição de prêmio' : 'Fechar cadastro de prêmio'}
        >
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
            </View>

            <ScrollView
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {error ? <InlineMessage message={error} variant="error" /> : null}

                {isArchived ? (
                    <InlineMessage
                        message="Este prêmio está arquivado e não aparece para os filhos."
                        variant="warning"
                    />
                ) : null}

                <Text style={[styles.sectionLabel, { color: colors.text.secondary }]}>
                    Escolha um ícone
                </Text>
                <View style={styles.emojiGrid}>
                    {PRIZE_EMOJIS.map((e) => (
                        <Pressable
                            key={e}
                            style={[
                                styles.emojiCell,
                                {
                                    backgroundColor: emoji === e ? colors.accent.adminBg : colors.bg.muted,
                                    borderColor: emoji === e ? colors.accent.admin : 'transparent',
                                },
                            ]}
                            onPress={() => setEmoji(e)}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: emoji === e }}
                            accessibilityLabel={`Ícone ${e}`}
                        >
                            <Text style={styles.emojiText}>{e}</Text>
                        </Pressable>
                    ))}
                </View>

                <Input
                    ref={nameInputRef}
                    label="Nome *"
                    value={name}
                    onChangeText={setName}
                    placeholder="Ex: Sorvete, Filme no cinema…"
                    autoFocus={!isEdit}
                    maxLength={100}
                    accessibilityLabel="Nome do prêmio"
                    noMarginBottom
                />

                <Input
                    label="Descrição"
                    value={description}
                    onChangeText={setDescription}
                    placeholder="Detalhes opcionais…"
                    multiline
                    numberOfLines={3}
                    maxLength={500}
                    style={styles.multilineInput}
                    accessibilityLabel="Descrição do prêmio"
                    noMarginBottom
                />

                <Input
                    label="Custo em pontos *"
                    value={costStr}
                    onChangeText={(v) => setCostStr(v.replaceAll(/\D/g, ''))}
                    placeholder="Ex: 50"
                    keyboardType="number-pad"
                    maxLength={7}
                    accessibilityLabel="Custo em pontos do prêmio"
                    noMarginBottom
                />

                <Input
                    label="Estoque"
                    value={stockStr}
                    onChangeText={(v) => setStockStr(v.replaceAll(/\D/g, ''))}
                    placeholder="Ex: 99"
                    keyboardType="number-pad"
                    maxLength={5}
                    accessibilityLabel="Estoque do prêmio"
                    noMarginBottom
                />

                {isEdit ? (
                    isArchived ? (
                        <Pressable
                            style={({ pressed }) => [
                                styles.archiveBtn,
                                { borderColor: colors.accent.admin },
                                pressed && { opacity: 0.7 },
                            ]}
                            onPress={handleUnarchive}
                            disabled={reactivateMutation.isPending}
                            accessibilityRole="button"
                            accessibilityLabel="Desarquivar prêmio"
                        >
                            <ArchiveRestore size={16} color={colors.accent.admin} strokeWidth={2} />
                            <Text style={[styles.archiveBtnText, { color: colors.accent.admin }]}>
                                Desarquivar prêmio
                            </Text>
                        </Pressable>
                    ) : (
                        <Pressable
                            style={({ pressed }) => [
                                styles.archiveBtn,
                                { borderColor: colors.semantic.error },
                                pressed && { opacity: 0.7 },
                            ]}
                            onPress={handleArchive}
                            disabled={deactivateMutation.isPending}
                            accessibilityRole="button"
                            accessibilityLabel="Arquivar prêmio"
                        >
                            <Archive size={16} color={colors.semantic.error} strokeWidth={2} />
                            <Text style={[styles.archiveBtnText, { color: colors.semantic.error }]}>
                                Arquivar prêmio
                            </Text>
                        </Pressable>
                    )
                ) : null}

                <Button
                    label={submitLabel}
                    loadingLabel={isEdit ? 'Salvando…' : 'Criando…'}
                    onPress={handleSubmit}
                    loading={isSaving}
                    accessibilityLabel={submitLabel}
                />
            </ScrollView>
        </BottomSheetModal>
    );
}

function makeStyles(colors: ThemeColors) {
    return StyleSheet.create({
        sheet: { maxHeight: '85%' },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing['4'],
        },
        title: {
            fontSize: typography.size.lg,
            fontFamily: typography.family.bold,
        },
        content: {
            gap: spacing['3'],
            paddingBottom: spacing['4'],
        },
        sectionLabel: {
            fontSize: typography.size.sm,
            fontFamily: typography.family.semibold,
        },
        emojiGrid: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing['2'],
        },
        emojiCell: {
            width: 48,
            height: 48,
            borderRadius: radii.lg,
            borderWidth: 2,
            alignItems: 'center',
            justifyContent: 'center',
        },
        emojiText: { fontSize: 28 },
        multilineInput: {
            minHeight: 80,
            textAlignVertical: 'top',
        },
        archiveBtn: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing['2'],
            paddingVertical: spacing['3'],
            borderRadius: radii.xl,
            borderCurve: 'continuous',
            borderWidth: 2,
        },
        archiveBtnText: {
            fontSize: typography.size.sm,
            fontFamily: typography.family.bold,
        },
    });
}
