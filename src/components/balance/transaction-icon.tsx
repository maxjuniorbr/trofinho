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

  const bgColor =
    category === 'ganho'
      ? colors.semantic.successBg
      : category === 'cofrinho'
        ? colors.semantic.infoBg
        : colors.semantic.errorBg;

  const iconColor =
    category === 'ganho'
      ? colors.semantic.successText
      : category === 'cofrinho'
        ? colors.semantic.infoText
        : colors.semantic.errorText;

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
