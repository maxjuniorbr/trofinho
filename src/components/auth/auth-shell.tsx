import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';

const mascotImage = loadMascotImage();

type AuthShellVariant = 'hero' | 'compact';

type AuthShellProps = Readonly<{
  title: string;
  subtitle: string;
  children: ReactNode;
  variant?: AuthShellVariant;
  headerTitle?: string;
  onBack?: () => void;
  backLabel?: string;
}>;

export function AuthShell({
  title,
  subtitle,
  children,
  variant = 'compact',
  headerTitle,
  onBack,
  backLabel,
}: AuthShellProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(variant), [variant]);

  const mascotScale = useRef(new Animated.Value(0)).current;
  const mascotRotate = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(mascotScale, { toValue: 1, damping: 8, useNativeDriver: true }),
      Animated.spring(mascotRotate, { toValue: 1, damping: 8, useNativeDriver: true }),
      Animated.spring(contentOpacity, { toValue: 1, damping: 12, useNativeDriver: true }),
      Animated.timing(contentY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [mascotScale, mascotRotate, contentOpacity, contentY]);

  const mascotRotateDeg = mascotRotate.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-10deg', '5deg', '0deg'],
  });

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
      behavior="padding"
    >
      {headerTitle ? (
        <ScreenHeader
          title={headerTitle}
          onBack={onBack}
          backLabel={backLabel}
          backTone="muted"
          surface="canvas"
          showBorder={false}
        />
      ) : null}
      <ScrollView
        style={[styles.flex, { backgroundColor: colors.bg.canvas }]}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StatusBar style={colors.statusBar} />

        <Animated.View
          style={[styles.mascotWrapper, { transform: [{ scale: mascotScale }, { rotate: mascotRotateDeg }] }]}
        >
          <Image
            source={mascotImage}
            style={styles.mascot}
            accessibilityLabel="Mascote do Trofinho"
            accessibilityRole="image"
          />
        </Animated.View>

        <Animated.View
          style={[styles.headline, { opacity: contentOpacity, transform: [{ translateY: contentY }] }]}
        >
          <Text style={[styles.title, { color: colors.text.primary }]}>{title}</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
            {subtitle}
          </Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.bg.surface,
              borderColor: colors.border.subtle,
              opacity: contentOpacity,
              transform: [{ translateY: contentY }],
            },
          ]}
        >
          {children}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function loadMascotImage(): number {
  try {
    return require('../../../assets/trofinho-mascot.png') as number;
  } catch {
    return 0;
  }
}

function makeStyles(variant: AuthShellVariant) {
  const isHero = variant === 'hero';

  return StyleSheet.create({
    flex: { flex: 1 },
    container: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: isHero ? 'center' : 'flex-start',
      paddingHorizontal: spacing.screen,
      paddingTop: isHero ? spacing['10'] : spacing['4'],
      paddingBottom: spacing['10'],
    },
    mascotWrapper: {
      marginBottom: isHero ? spacing['6'] : spacing['4'],
    },
    mascot: {
      width: isHero ? 140 : 100,
      height: isHero ? 140 : 100,
      resizeMode: 'contain',
    },
    headline: {
      alignItems: 'center',
      marginBottom: isHero ? spacing['8'] : spacing['6'],
    },
    title: {
      fontFamily: typography.family.black,
      fontSize: isHero ? typography.size['4xl'] : typography.size['3xl'],
      lineHeight: isHero ? typography.lineHeight['4xl'] : typography.lineHeight['3xl'],
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: typography.family.medium,
      fontSize: isHero ? typography.size.md : typography.size.sm,
      textAlign: 'center',
      marginTop: isHero ? spacing['2'] : spacing['1'],
      lineHeight: isHero ? typography.lineHeight.md : typography.lineHeight.sm,
    },
    card: {
      width: '100%',
      borderRadius: radii.outer,
      borderWidth: 1,
      padding: spacing['6'],
    },
  });
}
