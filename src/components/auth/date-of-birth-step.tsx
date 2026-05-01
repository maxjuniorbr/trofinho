import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

/** Earliest selectable date: 1 Jan 1900. */
const MIN_DATE = new Date(1900, 0, 1);

/** Returns today minus 13 years (latest selectable date). */
function getMaxDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear() - 13, now.getMonth(), now.getDate());
}

type DateOfBirthStepProps = Readonly<{
    value: Date | null;
    onChange: (date: Date) => void;
    onContinue: () => void;
    error: string | null;
    loading: boolean;
}>;

/**
 * Date-of-birth collection step for the onboarding flow.
 * Uses the native date picker from `@react-native-community/datetimepicker`.
 */
export function DateOfBirthStep({
    value,
    onChange,
    onContinue,
    error,
    loading,
}: DateOfBirthStepProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const maxDate = useMemo(() => getMaxDate(), []);

    // On Android the picker is shown as a modal dialog; we toggle visibility.
    const [showPicker, setShowPicker] = useState(false);

    const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowPicker(false);
        if (selectedDate) {
            onChange(selectedDate);
        }
    };

    const handleContinue = () => {
        onContinue();
    };

    const formattedDate = value
        ? value.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
        : null;

    const validationMessage =
        !value && !error
            ? 'Informe sua data de nascimento para continuar.'
            : null;

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Data de nascimento</Text>
            <Text style={styles.subtitle}>
                Precisamos dessa informação para personalizar sua experiência.
            </Text>

            {error ? <InlineMessage message={error} variant="error" /> : null}
            {validationMessage ? (
                <InlineMessage message={validationMessage} variant="info" />
            ) : null}

            {/* Pressable field that opens the native date dialog */}
            <Pressable
                onPress={() => setShowPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Selecionar data de nascimento"
                style={({ pressed }) => [
                    styles.dateField,
                    { opacity: pressed ? 0.8 : 1 },
                ]}
            >
                <Calendar
                    size={18}
                    color={colors.text.secondary}
                    strokeWidth={2}
                />
                <Text
                    style={[
                        styles.dateFieldText,
                        {
                            color: formattedDate
                                ? colors.text.primary
                                : colors.text.muted,
                        },
                    ]}
                >
                    {formattedDate ?? 'Selecionar data'}
                </Text>
            </Pressable>

            {showPicker ? (
                <View style={styles.pickerWrapper}>
                    <DateTimePicker
                        value={value ?? maxDate}
                        mode="date"
                        display="default"
                        minimumDate={MIN_DATE}
                        maximumDate={maxDate}
                        onChange={handleChange}
                        locale="pt-BR"
                        accessibilityLabel="Seletor de data de nascimento"
                    />
                </View>
            ) : null}

            <View style={styles.footer}>
                <Button
                    label="Continuar"
                    loadingLabel="Salvando…"
                    onPress={handleContinue}
                    loading={loading}
                    disabled={!value}
                    accessibilityLabel="Continuar"
                />
            </View>
        </View>
    );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        container: {
            gap: spacing['4'],
        },
        title: {
            fontFamily: typography.family.bold,
            fontSize: typography.size.xl,
            lineHeight: typography.lineHeight.xl,
            color: colors.text.primary,
        },
        subtitle: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.sm,
            lineHeight: typography.lineHeight.sm,
            color: colors.text.secondary,
        },
        dateField: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            borderWidth: 1,
            borderColor: colors.border.default,
            borderRadius: radii.lg,
            borderCurve: 'continuous',
            backgroundColor: colors.bg.elevated,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            minHeight: 48,
        },
        dateFieldText: {
            fontFamily: typography.family.semibold,
            fontSize: typography.size.md,
        },
        pickerWrapper: {
            alignItems: 'center',
        },
        footer: {
            marginTop: spacing['2'],
        },
    });
}
