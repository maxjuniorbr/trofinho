import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react-native';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export type InlineMessageVariant = 'error' | 'warning' | 'success' | 'info';

type InlineMessageProps = Readonly<{
  message: string;
  variant?: InlineMessageVariant;
}>;

function getVariantTokens(variant: InlineMessageVariant, colors: ThemeColors) {
  switch (variant) {
    case 'error':
      return {
        Icon: AlertCircle,
        backgroundColor: colors.semantic.errorBg,
        borderColor: colors.semantic.error,
        textColor: colors.semantic.errorText,
      };
    case 'warning':
      return {
        Icon: TriangleAlert,
        backgroundColor: colors.semantic.warningBg,
        borderColor: colors.semantic.warning,
        textColor: colors.semantic.warningText,
      };
    case 'success':
      return {
        Icon: CheckCircle2,
        backgroundColor: colors.semantic.successBg,
        borderColor: colors.semantic.success,
        textColor: colors.semantic.successText,
      };
    default:
      return {
        Icon: Info,
        backgroundColor: colors.semantic.infoBg,
        borderColor: colors.semantic.info,
        textColor: colors.semantic.infoText,
      };
  }
}

export function InlineMessage({ message, variant = 'info' }: InlineMessageProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { Icon, backgroundColor, borderColor, textColor } = getVariantTokens(variant, colors);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderColor: `${borderColor}40`,
        },
      ]}
      accessibilityLiveRegion="polite"
    >
      <Icon size={18} color={textColor} strokeWidth={2.25} />
      <Text style={[styles.message, { color: textColor }]}>{message}</Text>
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing['2'],
      borderWidth: 1,
      borderRadius: radii.lg,
      borderCurve: 'continuous',
      padding: spacing['3'],
      backgroundColor: colors.bg.surface,
    },
    message: {
      flex: 1,
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
      lineHeight: typography.lineHeight.md,
    },
  });
}
