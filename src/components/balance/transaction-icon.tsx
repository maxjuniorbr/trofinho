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
import { isCredit, type TransactionType } from '@lib/balances';
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
  const credit = isCredit(type);
  const Icon = TRANSACTION_ICONS[type];

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: credit ? colors.semantic.successBg : colors.semantic.errorBg },
        style,
      ]}
    >
      <Icon
        size={size}
        color={credit ? colors.semantic.successText : colors.semantic.errorText}
        strokeWidth={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
