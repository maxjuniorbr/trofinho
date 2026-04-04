import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { spacing } from '@/constants/theme';

type ListFooterProps = Readonly<{ loading: boolean }>;

export function ListFooter({ loading }: ListFooterProps) {
  const { colors } = useTheme();
  if (!loading) return null;
  return (
    <View style={styles.container}>
      <ActivityIndicator size="small" color={colors.brand.vivid} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing['4'], alignItems: 'center' },
});
