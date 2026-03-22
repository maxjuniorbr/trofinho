import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';

type SafeScreenFrameProps = Readonly<{
  children: ReactNode;
  topInset?: boolean;
  bottomInset?: boolean;
  style?: StyleProp<ViewStyle>;
}>;

export function SafeScreenFrame({
  children,
  topInset = false,
  bottomInset = true,
  style,
}: SafeScreenFrameProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: colors.bg.canvas,
          paddingTop: topInset ? insets.top : 0,
          paddingBottom: bottomInset ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
