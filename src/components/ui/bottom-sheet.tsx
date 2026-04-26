import type { ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type KeyboardAvoidingViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { radii, spacing } from '@/constants/theme';

const CLOSE_DISTANCE = 64;
const CLOSE_VELOCITY = 900;
// Floor used when the safe-area inset is unknown (e.g. on the very first
// frame of a freshly opened Modal window). Comfortably clears typical
// Android navigation bars (button nav ≈ 48dp, gesture nav ≈ 24dp).
const MIN_BOTTOM_PADDING = spacing['8'];

// On iOS, KeyboardAvoidingView with 'padding' works reliably inside Modals.
// On Android with edge-to-edge (Expo SDK 55+ / RN 0.83+), transparent Modal
// windows no longer resize when the keyboard opens, and the built-in
// KeyboardAvoidingView leaves stale bottom padding after the keyboard closes.
// We handle Android ourselves via Keyboard event listeners + Reanimated.
const getDefaultKeyboardBehavior = (): KeyboardAvoidingViewProps['behavior'] =>
  Platform.OS === 'ios' ? 'padding' : undefined;

// ---------------------------------------------------------------------------
// Android keyboard spacer – listens to Keyboard events and drives a
// Reanimated shared value so the sheet content shrinks above the keyboard.
// ---------------------------------------------------------------------------
function useAndroidKeyboardHeight() {
  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 220 });
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      keyboardHeight.value = withTiming(0, { duration: 180 });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [keyboardHeight]);

  return keyboardHeight;
}

type BottomSheetBaseProps = Readonly<{
  children: ReactNode;
  onClose: () => void;
  sheetStyle?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  scrimColor?: string;
  closeLabel?: string;
  keyboardBehavior?: KeyboardAvoidingViewProps['behavior'];
  keyboardVerticalOffset?: number;
}>;

type BottomSheetModalProps = BottomSheetBaseProps &
  Readonly<{
    visible: boolean;
    onShow?: () => void;
  }>;

export function BottomSheetModal({
  visible,
  onShow,
  onClose,
  keyboardBehavior = getDefaultKeyboardBehavior(),
  keyboardVerticalOffset,
  ...props
}: BottomSheetModalProps) {
  return (
    // statusBarTranslucent + navigationBarTranslucent are required for the
    // native Modal to behave correctly inside Android's edge-to-edge layout
    // (default in Expo SDK 55 / RN 0.83). Without them, on the first open of
    // the Modal the window does not account for the navigation bar inset
    // until a relayout (e.g. opening/closing the keyboard) happens — that
    // is why the primary button visibly overlaps the system buttons until
    // a field is focused. See:
    //   https://reactnative.dev/docs/modal#navigationbartranslucent-android
    //   https://github.com/zoontek/react-native-edge-to-edge#modal-component-quirks
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      onShow={onShow}
    >
      {/* The Modal renders into its own native window, so the root
          SafeAreaProvider does not propagate. Wrapping with another
          provider seeded with `initialWindowMetrics` gives us the correct
          insets synchronously on the first frame. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardAvoidingView
            style={styles.root}
            enabled={keyboardBehavior !== undefined}
            behavior={keyboardBehavior}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            <BottomSheetFrame onClose={onClose} {...props} />
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </Modal>
  );
}

export function BottomSheetOverlay({
  visible,
  onShow: _onShow,
  onClose,
  keyboardBehavior = getDefaultKeyboardBehavior(),
  keyboardVerticalOffset,
  ...props
}: BottomSheetModalProps) {
  if (!visible) return null;

  return (
    <GestureHandlerRootView style={styles.absoluteRoot}>
      <KeyboardAvoidingView
        style={styles.root}
        enabled={keyboardBehavior !== undefined}
        behavior={keyboardBehavior}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <BottomSheetFrame onClose={onClose} {...props} />
      </KeyboardAvoidingView>
    </GestureHandlerRootView>
  );
}

function BottomSheetFrame({
  children,
  onClose,
  sheetStyle,
  contentStyle,
  scrimColor,
  closeLabel = 'Fechar',
}: BottomSheetBaseProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(0);
  const androidKbHeight = useAndroidKeyboardHeight();

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-8, 8])
        .onUpdate((event) => {
          'worklet';
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          'worklet';
          if (event.translationY > CLOSE_DISTANCE || event.velocityY > CLOSE_VELOCITY) {
            scheduleOnRN(onClose);
            return;
          }
          translateY.value = withSpring(0);
        }),
    [onClose, translateY],
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // On Android, apply an animated bottom padding that matches the keyboard
  // height so the sheet content shrinks above the keyboard. On iOS this is
  // handled by the KeyboardAvoidingView wrapper.
  const animatedKeyboardPadding = useAnimatedStyle(() => ({
    paddingBottom: androidKbHeight.value,
  }));

  // Always clear at least MIN_BOTTOM_PADDING so the primary button never
  // overlaps the navigation bar even if the safe-area inset is reported
  // as 0 (which happens on the very first frame inside a Modal window
  // before native layout settles).
  const safeBottom = Math.max(insets.bottom, MIN_BOTTOM_PADDING);

  return (
    <Animated.View style={[styles.root, animatedKeyboardPadding]}>
      <Pressable
        style={[styles.scrim, { backgroundColor: scrimColor ?? colors.overlay.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={closeLabel}
      />
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.bg.surface },
          sheetStyle,
          animatedSheetStyle,
        ]}
      >
        <GestureDetector gesture={panGesture}>
          <Pressable
            style={styles.handleTarget}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          >
            <View style={[styles.handleBar, { backgroundColor: colors.border.subtle }]} />
          </Pressable>
        </GestureDetector>
        <View style={[styles.content, { paddingBottom: spacing['6'] + safeBottom }, contentStyle]}>
          {children}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  absoluteRoot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  sheet: {
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    overflow: 'hidden',
    // Allow the sheet to shrink within the parent flex column when its
    // natural content height would exceed `maxHeight`. Without this, RN
    // ignores `maxHeight` and the sheet expands beyond the screen, pushing
    // the bottom of children (e.g. a primary action button at the end of
    // a ScrollView) below the visible area — and right onto the system
    // navigation bar on Android.
    flexShrink: 1,
  },
  handleTarget: {
    alignItems: 'center',
    paddingTop: spacing['3'],
    paddingBottom: spacing['2'],
  },
  handleBar: {
    width: 36,
    height: 4,
    borderRadius: radii.full,
  },
  content: {
    paddingHorizontal: spacing['6'],
    paddingTop: spacing['2'],
    // Match the sheet so any inner ScrollView is bounded by the sheet's
    // available height (instead of growing to its full content height and
    // leaking past the sheet's overflow:hidden clip).
    flexShrink: 1,
    minHeight: 0,
  },
});
