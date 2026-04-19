import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet, View } from 'react-native';
import {
  Wallet,
  TrendingUp,
  CheckCircle2,
  ArrowDownCircle,
  AlertTriangle,
  Gift,
  RotateCcw,
  PiggyBank,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { getTransactionCategory, type TransactionType } from '@lib/balances';
import { useTheme } from '@/context/theme-context';

const TRANSACTION_ICONS: Record<TransactionType, LucideIcon> = {
  credito: CheckCircle2,
  debito: ArrowDownCircle,
  transferencia_cofrinho: Wallet,
  valorizacao: TrendingUp,
  penalizacao: AlertTriangle,
  resgate: Gift,
  estorno_resgate: RotateCcw,
  resgate_cofrinho: PiggyBank,
};

type TransactionIconProps = Readonly<{
  type: TransactionType;
  style?: StyleProp<ViewStyle>;
  size?: number;
}>;

export function TransactionIcon({ type, style, size = 16 }: TransactionIconProps) {
  const { colors } = useTheme();
  const category = getTransactionCategory(type);
  const Icon = TRANSACTION_ICONS[type];

  const colorMap = {
    ganho: { bg: colors.semantic.successBg, fg: colors.semantic.successText },
    cofrinho: { bg: colors.semantic.infoBg, fg: colors.semantic.infoText },
    gasto: { bg: colors.semantic.errorBg, fg: colors.semantic.errorText },
  } as const;

  const bgColor = colorMap[category].bg;
  const iconColor = colorMap[category].fg;

  return (
    <View style={[styles.base, { backgroundColor: bgColor }, style]}>
      <Icon size={size} color={iconColor} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
