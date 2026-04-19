import type { ReactNode } from 'react';
import { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
  type KeyboardAvoidingViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
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

const getDefaultKeyboardBehavior = (): KeyboardAvoidingViewProps['behavior'] => 'padding';

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
  }>;

export function BottomSheetModal({
  visible,
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
    >
      {/* The Modal renders into its own native window, so the root
          SafeAreaProvider does not propagate. Wrapping with another
          provider seeded with `initialWindowMetrics` gives us the correct
          insets synchronously on the first frame. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <GestureHandlerRootView style={styles.root}>
          <KeyboardAvoidingView
            style={styles.root}
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
            runOnJS(onClose)();
            return;
          }
          translateY.value = withSpring(0);
        }),
    [onClose, translateY],
  );

  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Always clear at least MIN_BOTTOM_PADDING so the primary button never
  // overlaps the navigation bar even if the safe-area inset is reported
  // as 0 (which happens on the very first frame inside a Modal window
  // before native layout settles).
  const safeBottom = Math.max(insets.bottom, MIN_BOTTOM_PADDING);

  return (
    <View style={styles.root}>
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
        <View
          style={[
            styles.content,
            { paddingBottom: spacing['6'] + safeBottom },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  absoluteRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
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
