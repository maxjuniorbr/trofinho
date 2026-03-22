import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';
import { InlineMessage, type InlineMessageVariant } from '@/components/ui/inline-message';
import { getSafeBottomPadding } from '@lib/safe-area';

type FormFooterProps = Readonly<{
  children: ReactNode;
  compact?: boolean;
  includeSafeBottom?: boolean;
  message?: string | null;
  variant?: InlineMessageVariant;
}>;

export function FormFooter({
  children,
  compact = false,
  includeSafeBottom = true,
  message = null,
  variant = 'error',
}: FormFooterProps) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(compact, insets.bottom, includeSafeBottom),
    [compact, insets.bottom, includeSafeBottom],
  );

  return (
    <View style={styles.container}>
      {message ? <InlineMessage message={message} variant={variant} /> : null}
      {children}
    </View>
  );
}

function makeStyles(compact: boolean, bottomInset: number, includeSafeBottom: boolean) {
  return StyleSheet.create({
    container: {
      paddingTop: compact ? 0 : spacing['2'],
      paddingBottom: includeSafeBottom
        ? getSafeBottomPadding({ top: 0, bottom: bottomInset }, compact ? spacing['2'] : spacing['4'])
        : 0,
      gap: spacing['3'],
    },
  });
}
