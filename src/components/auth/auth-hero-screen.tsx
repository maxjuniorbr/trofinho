import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@/constants/theme';
import { useHeroPalette } from '@/components/auth/use-hero-palette';

type AuthHeroScreenProps = Readonly<{
  children: ReactNode;
  topBarRight?: ReactNode;
  topBarCenter?: ReactNode;
  onBack?: () => void;
  backAccessibilityLabel?: string;
}>;

/**
 * Hero shell used by the auth flow (login, signup, forgot-password).
 *
 * Keyboard strategy: the body uses a fixed `minHeight` captured on first
 * layout (before the keyboard opens). This keeps footer elements positioned
 * with `marginTop: 'auto'` anchored at the bottom of the viewport regardless
 * of keyboard state. The ScrollView allows the user to scroll to any input
 * when the keyboard is open, while `adjustResize` (Android default) shrinks
 * the window so the ScrollView becomes scrollable.
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

  // Capture the body height on first layout (before keyboard opens).
  // This becomes the fixed minHeight so the footer stays anchored.
  const [bodyMinHeight, setBodyMinHeight] = useState(0);
  const captured = useRef(false);

  const onBodyLayout = (e: LayoutChangeEvent) => {
    if (captured.current) return;
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      captured.current = true;
      setBodyMinHeight(h);
    }
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const styles = useMemo(
    () => makeStyles(insets.top, insets.bottom, keyboardOpen, bodyMinHeight, palette),
    [insets.top, insets.bottom, keyboardOpen, bodyMinHeight, palette],
  );
  const hasTopBar = Boolean(onBack ?? topBarRight ?? topBarCenter);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
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

          <View style={styles.body} onLayout={onBodyLayout}>
            {children}
          </View>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
};

function makeStyles(
  topInset: number,
  bottomInset: number,
  keyboardOpen: boolean,
  bodyMinHeight: number,
  palette: ReturnType<typeof useHeroPalette>['palette'],
) {
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
      paddingBottom: Math.max(bottomInset, spacing['8']),
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
      // Before first layout: flex: 1 fills the screen so the footer lands
      // at the bottom. After layout: minHeight locks that height so the
      // footer doesn't move when the keyboard shrinks the window.
      ...(bodyMinHeight > 0 ? { minHeight: bodyMinHeight } : { flex: 1 }),
    },
  });
}
