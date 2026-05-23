import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, {
    type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Calendar } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

/** Earliest selectable date: 1 Jan 1900. */
const MIN_DATE = new Date(1900, 0, 1);

/** Returns today minus `years` years (latest selectable date). */
function getMaxDate(years: number): Date {
    const now = new Date();
    return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}

type DateOfBirthFieldProps = Readonly<{
    value: Date | null;
    onChange: (date: Date) => void;
    error?: string | null;
    hint?: string;
    disabled?: boolean;
    /** Minimum required age in years. Defaults to 8. */
    minAge?: number;
    /** 'hero' renders with the auth hero palette (translucent dark field). */
    variant?: 'default' | 'hero';
}>;

type FieldColors = {
    fieldBg: string;
    fieldBorder: string;
    textColor: string;
    placeholderColor: string;
    iconColor: string;
    labelColor: string;
    errorColor: string;
    hintColor: string;
};

function resolveFieldColors(
    variant: 'default' | 'hero',
    colors: ReturnType<typeof useTheme>['colors'],
    heroColors: ReturnType<typeof useHeroPalette>['palette'],
    error: string | null | undefined,
    value: Date | null,
    disabled: boolean | undefined,
): FieldColors {
    if (variant === 'hero') {
        const hp = heroColors;
        let fieldBorder: string;
        if (error) {
            fieldBorder = colors.semantic.error;
        } else if (value) {
            fieldBorder = hp.borderFocus;
        } else {
            fieldBorder = hp.borderSoft;
        }
        return {
            fieldBg: hp.surfaceField,
            fieldBorder,
            textColor: hp.textOnNavy,
            placeholderColor: hp.textOnNavyFaint,
            iconColor: hp.textOnNavySubtle,
            labelColor: hp.textOnNavySubtle,
            errorColor: colors.semantic.error,
            hintColor: hp.textOnNavyFaint,
        };
    }
    return {
        fieldBg: disabled ? colors.bg.muted : colors.bg.surface,
        fieldBorder: error ? colors.semantic.error : colors.border.default,
        textColor: colors.text.primary,
        placeholderColor: colors.text.muted,
        iconColor: colors.text.secondary,
        labelColor: colors.text.secondary,
        errorColor: colors.semantic.error,
        hintColor: colors.text.muted,
    };
}

/**
 * Date-of-birth picker field styled to match the standard `Input` component.
 * Opens the native date picker on press.
 */
export function DateOfBirthField({ value, onChange, error, hint, disabled, minAge = 8, variant = 'default' }: DateOfBirthFieldProps) {
    const { colors } = useTheme();
    const { palette } = useHeroPalette();
    const styles = useMemo(() => makeStyles(), []);
    const maxDate = useMemo(() => getMaxDate(minAge), [minAge]);
    const [showPicker, setShowPicker] = useState(false);

    const { fieldBg, fieldBorder, textColor, placeholderColor, iconColor, labelColor, errorColor, hintColor } =
        resolveFieldColors(variant, colors, palette, error, value, disabled);

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
            <Text style={[styles.label, { color: labelColor }]}>Data de nascimento</Text>

            <Pressable
                onPress={() => !disabled && setShowPicker(true)}
                disabled={disabled}
                accessibilityRole="button"
                accessibilityLabel="Selecionar data de nascimento"
                accessibilityState={{ disabled: Boolean(disabled) }}
                style={({ pressed }) => [
                    styles.field,
                    {
                        borderColor: fieldBorder,
                        backgroundColor: fieldBg,
                        opacity: pressed && !disabled ? 0.8 : 1,
                    },
                ]}
            >
                <Calendar size={18} color={iconColor} strokeWidth={2} />
                <Text
                    style={[
                        styles.fieldText,
                        { color: formattedDate ? textColor : placeholderColor },
                    ]}
                >
                    {formattedDate ?? 'Selecionar data'}
                </Text>
            </Pressable>

            {error ? (
                <Text style={[styles.errorText, { color: errorColor }]}>{error}</Text>
            ) : null}
            {!error && hint ? (
                <Text style={[styles.hintText, { color: hintColor }]}>{hint}</Text>
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

function makeStyles() {
    return StyleSheet.create({
        wrapper: {
            marginBottom: spacing['4'],
        },
        label: {
            fontFamily: typography.family.extrabold,
            fontSize: typography.size.xxs,
            textTransform: 'uppercase',
            letterSpacing: 0,
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
        hintText: {
            fontFamily: typography.family.medium,
            fontSize: typography.size.xs,
            lineHeight: typography.lineHeight.xs,
            marginTop: spacing['1'],
        },
        pickerWrapper: {
            alignItems: 'center',
            marginTop: spacing['2'],
        },
    });
}
