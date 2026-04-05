import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { spacing, typography, type ThemeColors } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';

const SLIDE_OFFSET = 100;

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const { colors } = useTheme();
  const { top } = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-SLIDE_OFFSET)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -SLIDE_OFFSET : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOnline, translateY]);

  const styles = useMemo(() => makeStyles(colors, top), [colors, top]);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }] }]}
      accessibilityLiveRegion="polite"
      accessibilityLabel="Sem conexão com a internet"
    >
      <Text style={styles.text}>Sem conexão com a internet</Text>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors, top: number) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingTop: top + spacing['2'],
      paddingBottom: spacing['2'],
      paddingHorizontal: spacing.screen,
      backgroundColor: colors.semantic.warningBg,
      zIndex: 999,
      alignItems: 'center',
    },
    text: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.sm,
      color: colors.semantic.warningText,
    },
  });
