import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

/** Earliest selectable date: 1 Jan 1900. */
const MIN_DATE = new Date(1900, 0, 1);

/** Returns today minus 8 years (latest selectable date). */
function getMaxDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear() - 8, now.getMonth(), now.getDate());
}

type DateOfBirthFieldProps = Readonly<{
    value: Date | null;
    onChange: (date: Date) => void;
    error?: string | null;
    disabled?: boolean;
}>;

/**
 * Date-of-birth picker field styled to match the standard `Input` component.
 * Opens the native date picker on press.
 */
export function DateOfBirthField({ value, onChange, error, disabled }: DateOfBirthFieldProps) {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const maxDate = useMemo(() => getMaxDate(), []);
    const [showPicker, setShowPicker] = useState(false);

    const handleChange = (_event: DateTimePickerEvent, selectedDate?: Date) => {
        setShowPicker(false);
        if (selectedDate) {
            onChange(selectedDate);
        }
    };

    const formattedDate = value
        ? value.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        })
        : null;

    return (
        <View style={styles.wrapper}>
            <Text style={[styles.label, { color: colors.text.secondary }]}>Data de nascimento</Text>

            <Pressable
                onPress={() => !disabled && setShowPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Selecionar data de nascimento"
                style={({ pressed }) => [
                    styles.field,
                    {
                        borderColor: error ? colors.border.error : colors.border.default,
                        backgroundColor: disabled ? colors.bg.muted : colors.bg.surface,
                        opacity: pressed && !disabled ? 0.8 : 1,
                    },
                ]}
            >
                <Calendar size={18} color={colors.text.secondary} strokeWidth={2} />
                <Text
                    style={[
                        styles.fieldText,
                        { color: formattedDate ? colors.text.primary : colors.text.muted },
                    ]}
                >
                    {formattedDate ?? 'Selecionar data'}
                </Text>
            </Pressable>

            {error ? (
                <Text style={[styles.errorText, { color: colors.semantic.error }]}>{error}</Text>
            ) : null}

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
        </View>
    );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
    return StyleSheet.create({
        wrapper: {
            marginBottom: spacing['4'],
        },
        label: {
            fontSize: typography.size.sm,
            fontWeight: typography.weight.semibold,
            marginBottom: spacing['1'],
        },
        field: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing['3'],
            borderWidth: 1,
            borderRadius: radii.md,
            paddingHorizontal: spacing['4'],
            paddingVertical: spacing['3'],
            minHeight: 48,
        },
        fieldText: {
            fontFamily: typography.family.semibold,
            fontSize: typography.size.md,
        },
        errorText: {
            fontSize: typography.size.xs,
            marginTop: spacing['1'],
        },
        pickerWrapper: {
            alignItems: 'center',
            marginTop: spacing['2'],
        },
    });
}
