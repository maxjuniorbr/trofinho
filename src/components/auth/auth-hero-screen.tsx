import { StatusBar } from 'expo-status-bar';
import { useMemo, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gradients, heroPalette, radii, spacing } from '@/constants/theme';

type AuthHeroScreenProps = Readonly<{
  children: ReactNode;
  /**
   * Optional top-bar content rendered above the form area. When `onBack` is
   * provided, a navy back chip is rendered on the leading edge automatically.
   */
  topBarRight?: ReactNode;
  topBarCenter?: ReactNode;
  onBack?: () => void;
  backAccessibilityLabel?: string;
}>;

/**
 * Single-surface dark hero shell used by the auth flow (login, signup,
 * forgot-password). Renders a navy gradient backdrop, two ambient gold halos
 * and a keyboard-aware scrollable content area. Independent of the active
 * light/dark theme — this surface is always dark navy.
 */
export const AuthHeroScreen = ({
  children,
  topBarRight,
  topBarCenter,
  onBack,
  backAccessibilityLabel,
}: AuthHeroScreenProps) => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(insets.top, insets.bottom), [insets.top, insets.bottom]);
  const hasTopBar = Boolean(onBack ?? topBarRight ?? topBarCenter);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.flex}>
        <LinearGradient
          colors={gradients.heroNavy.colors}
          locations={gradients.heroNavy.locations}
          start={gradients.heroNavy.start}
          end={gradients.heroNavy.end}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.glowTopRight} pointerEvents="none" />
        <View style={styles.glowBottomLeft} pointerEvents="none" />

        <StatusBar style="light" />

        <ScrollView
          style={styles.flex}
          overScrollMode="never"
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
                    <ChevronLeft size={20} color={heroPalette.textOnNavy} strokeWidth={2} />
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

function makeStyles(topInset: number, bottomInset: number) {
  return StyleSheet.create({
    flex: { flex: 1, backgroundColor: heroPalette.navyDeep },
    glowTopRight: {
      position: 'absolute',
      top: -160,
      right: -120,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: heroPalette.glowGold,
      opacity: 0.55,
    },
    glowBottomLeft: {
      position: 'absolute',
      bottom: -160,
      left: -120,
      width: 400,
      height: 400,
      borderRadius: 200,
      backgroundColor: heroPalette.glowGoldSoft,
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
      backgroundColor: heroPalette.surfaceChip,
      borderWidth: 1,
      borderColor: heroPalette.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
    },
  });
}
