import { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { spacing } from '@/constants/theme';
import { getSafeHorizontalPadding } from '@lib/safe-area';
import { ScreenHeader } from '@/components/ui/screen-header';

type StickyFooterScreenProps = Readonly<{
  title: string;
  onBack?: () => void;
  backLabel?: string;
  role?: 'admin' | 'filho';
  rightAction?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  keyboardAvoiding?: boolean;
  contentPadding?: number;
  contentGap?: number;
  contentStyle?: StyleProp<ViewStyle>;
  footerSurface?: 'canvas' | 'surface';
  headerSurface?: 'canvas' | 'surface';
  headerBorder?: boolean;
}>;

export function StickyFooterScreen({
  title,
  onBack,
  backLabel,
  role = 'admin',
  rightAction,
  children,
  footer,
  keyboardAvoiding = false,
  contentPadding = spacing['5'],
  contentGap = 0,
  contentStyle,
  footerSurface = 'canvas',
  headerSurface = 'surface',
  headerBorder = true,
}: StickyFooterScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const contentBaseStyle: ViewStyle = {
    flexGrow: 1,
    paddingTop: contentPadding,
    paddingBottom: contentPadding + (footer ? spacing['3'] : 0),
    paddingLeft: contentPadding + insets.left,
    paddingRight: contentPadding + insets.right,
    gap: contentGap,
  };

  const footerBackground = footerSurface === 'surface' ? colors.bg.surface : colors.bg.canvas;

  const body = (
    <View style={styles.flex}>
      <ScreenHeader
        title={title}
        onBack={onBack}
        backLabel={backLabel}
        role={role}
        rightAction={rightAction}
        surface={headerSurface}
        showBorder={headerBorder}
      />

      <View style={styles.flex}>
        <ScrollView
          style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
          contentContainerStyle={[contentBaseStyle, contentStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor: footerBackground,
                borderTopColor: colors.border.subtle,
                paddingBottom: Math.max(insets.bottom - spacing['2'], spacing['1']),
                ...getSafeHorizontalPadding(insets, spacing['5']),
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (!keyboardAvoiding) {
    return <View style={[styles.flex, { backgroundColor: colors.bg.canvas }]}>{body}</View>;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  footer: {
    borderTopWidth: 1,
    paddingTop: spacing['2'],
  },
});
