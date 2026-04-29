import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type AuthHeroScreenProps = Readonly<{
  children: ReactNode;
  /**
   * Optional top-bar content rendered above the form area. When `onBack` is
   * provided, a back chip is rendered on the leading edge automatically.
   */
  topBarRight?: ReactNode;
  topBarCenter?: ReactNode;
  onBack?: () => void;
  backAccessibilityLabel?: string;
}>;

/**
 * Hero shell used by the auth flow (login, signup, forgot-password). Renders
 * a gradient backdrop with two ambient gold halos and a keyboard-aware
 * scrollable content area. The surface follows the device color scheme: dark
 * devices get the navy hero, light devices get the warm cream hero.
 */
export const AuthHeroScreen = ({
  children,
  topBarRight,
  topBarCenter,
  onBack,
  backAccessibilityLabel,
}: AuthHeroScreenProps) => {
  const insets = useSafeAreaInsets();
  const { palette, gradient, isDark } = useHeroPalette();
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const styles = useMemo(
    () => makeStyles(insets.top, insets.bottom, keyboardOpen, palette),
    [insets.top, insets.bottom, keyboardOpen, palette],
  );
  const hasTopBar = Boolean(onBack ?? topBarRight ?? topBarCenter);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior="padding"
    >
      <View style={styles.flex}>
        <LinearGradient
          colors={gradient.colors}
          locations={gradient.locations}
          start={gradient.start}
          end={gradient.end}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />

        <StatusBar style={isDark ? 'light' : 'dark'} />

        <ScrollView
          style={styles.flex}
          overScrollMode="never"
          bounces={keyboardOpen}
          scrollEnabled={keyboardOpen}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {hasTopBar ? (
            <View style={styles.topBar}>
              <View style={styles.topBarSlot}>
                {onBack ? (
                  <Pressable
                    onPress={onBack}
                    accessibilityRole="button"
                    accessibilityLabel={backAccessibilityLabel ?? 'Voltar'}
                    hitSlop={8}
                    style={({ pressed }) => [styles.backChip, { opacity: pressed ? 0.7 : 1 }]}
                  >
                    <ChevronLeft size={20} color={palette.textOnNavy} strokeWidth={2} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.topBarCenter}>{topBarCenter}</View>
              <View style={styles.topBarSlot}>{topBarRight}</View>
            </View>
          ) : null}

          <View style={styles.body}>{children}</View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

function makeStyles(
  topInset: number,
  bottomInset: number,
  keyboardOpen: boolean,
  palette: ReturnType<typeof useHeroPalette>['palette'],
) {
  // Extra bottom padding when keyboard is open so the last field can scroll
  // above the keyboard. When closed, use only the safe-area inset so the
  // content fits the screen without unnecessary scroll.
  const extraBottom = keyboardOpen ? spacing['8'] : 0;

  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: palette.navyDeep },
    glowTopRight: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: palette.glowGold,
      opacity: 0.55,
    },
    glowBottomLeft: {
      position: 'absolute',
      bottom: -160,
      left: -120,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: palette.glowGoldSoft,
      opacity: 0.55,
    },
    scrollContent: {
      flexGrow: 1,
      paddingTop: topInset + spacing['4'],
      paddingBottom: Math.max(bottomInset, spacing['8']) + extraBottom,
      paddingHorizontal: spacing['6'],
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing['4'],
    },
    topBarSlot: {
      width: 40,
      height: 40,
      alignItems: 'flex-start',
      justifyContent: 'center',
    },
    topBarCenter: {
      flex: 1,
      alignItems: 'center',
    },
    backChip: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: palette.surfaceChip,
      borderWidth: 1,
      borderColor: palette.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
    },
  });
}
