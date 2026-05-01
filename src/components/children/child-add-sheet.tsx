import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { UserPlus } from 'lucide-react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { supabase } from '@lib/supabase';

type ChildAddSheetProps = Readonly<{
    visible: boolean;
    familiaId: string | undefined;
    onClose: () => void;
    onChildAdded: (childName: string) => void;
}>;

/**
 * Bottom sheet for adding a new child to the family.
 * Creates a `filhos` record (name only, no auth user) and calls
 * `onChildAdded` so the parent screen can generate an invite code.
 */
export function ChildAddSheet({ visible, familiaId, onClose, onChildAdded }: ChildAddSheetProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const nameInputRef = useRef<TextInput>(null);

    const [name, setName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const resetForm = useCallback(() => {
        setName('');
        setError(null);
        setLoading(false);
    }, []);

    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [resetForm, onClose]);

    const handleSubmit = useCallback(async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            setError('Informe o nome do filho.');
            return;
        }

        if (!familiaId) {
            setError('Perfil não carregado. Tente novamente.');
            return;
        }

        setError(null);
        setLoading(true);

        const { error: insertError } = await supabase
            .from('filhos')
            .insert({ familia_id: familiaId, nome: trimmed });

        if (insertError) {
            setLoading(false);
            if (insertError.message?.includes('limite') || insertError.message?.includes('5')) {
                setError('Limite de 5 filhos por família atingido.');
            } else {
                setError('Não foi possível cadastrar. Tente novamente.');
            }
            return;
        }

        setLoading(false);
        resetForm();
        onChildAdded(trimmed);
    }, [name, familiaId, resetForm, onChildAdded]);

    return (
        <BottomSheetModal
            visible={visible}
            onClose={handleClose}
            sheetStyle={styles.sheet}
            closeLabel="Fechar cadastro de filho"
        >
            <View style={styles.header}>
                <View style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}>
                    <UserPlus size={18} color={colors.accent.adminDim} strokeWidth={2.4} />
                </View>
                <View style={styles.headerText}>
                    <Text style={[styles.title, { color: colors.text.primary }]}>Cadastrar filho</Text>
                    <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
                        Informe o nome e gere um convite para vincular a conta Google
                    </Text>
                </View>
            </View>

            <ScrollView
                overScrollMode="never"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                {error ? <InlineMessage message={error} variant="error" /> : null}

                <View style={styles.field}>
                    <Text style={[styles.fieldLabel, { color: colors.text.secondary }]}>Nome do filho</Text>
                    <TextInput
                        ref={nameInputRef}
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.bg.elevated,
                                borderColor: colors.border.default,
                                color: colors.text.primary,
                            },
                        ]}
                        value={name}
                        onChangeText={(v) => {
                            setName(v);
                            setError(null);
                        }}
                        placeholder="Ex: Lucas"
                        placeholderTextColor={colors.text.muted}
                        autoCapitalize="words"
                        maxLength={60}
                        editable={!loading}
                        accessibilityLabel="Nome do filho"
                        autoFocus
                    />
                </View>

                <Button
                    label="Cadastrar e gerar convite"
                    loadingLabel="Cadastrando…"
                    loading={loading}
                    onPress={handleSubmit}
                    disabled={!name.trim()}
                    accessibilityLabel="Cadastrar filho e gerar convite"
                />
            </ScrollView>
        </BottomSheetModal>
    );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        sheet: { maxHeight: '70%' },
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
        headerText: { flex: 1, gap: spacing['0.5'] },
        title: { fontSize: typography.size.md, fontFamily: typography.family.bold },
        subtitle: { fontSize: typography.size.xs, fontFamily: typography.family.semibold },
        content: { gap: spacing['4'], paddingBottom: spacing['4'] },
        field: { gap: spacing['1'] },
        fieldLabel: { fontFamily: typography.family.semibold, fontSize: typography.size.xs },
        input: {
            height: 48,
            borderRadius: radii.lg,
            borderWidth: 1,
            paddingHorizontal: spacing['4'],
            fontFamily: typography.family.medium,
            fontSize: typography.size.sm,
        },
    });
}
