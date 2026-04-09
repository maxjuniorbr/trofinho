import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { useTheme } from '@/context/theme-context';
import { radii, spacing } from '@/constants/theme';

type SkeletonProps = Readonly<{
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}>;

function SkeletonBox({ width = '100%', height = 16, borderRadius = radii.md, style }: SkeletonProps) {
  const { colors } = useTheme();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: colors.bg.muted, opacity },
        style,
      ]}
    />
  );
}

export function HomeScreenSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      {/* Hero: greeting, name, family */}
      <View style={styles.heroSkeleton}>
        <SkeletonBox width={120} height={14} />
        <SkeletonBox width={180} height={32} style={{ marginTop: spacing['2'] }} />
        <SkeletonBox width={100} height={14} style={{ marginTop: spacing['1'] }} />
      </View>

      {/* Mascot image + caption */}
      <SkeletonBox width={120} height={120} borderRadius={radii.full} />
      <SkeletonBox width={160} height={14} />

      {/* Summary card (MEU SALDO — label, total, progress bar, 2 boxes) */}
      <SkeletonBox height={180} borderRadius={radii.xl} />

      {/* Quick actions row (4 cards) */}
      <View style={styles.cardsRow}>
        <SkeletonBox height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        <SkeletonBox height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        <SkeletonBox height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        <SkeletonBox height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function AdminHomeScreenSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      {/* Hero: greeting + name left, avatar right */}
      <View style={styles.adminHeroRow}>
        <View style={styles.adminHeroText}>
          <SkeletonBox width={100} height={14} />
          <SkeletonBox width={200} height={28} style={{ marginTop: spacing['2'] }} />
        </View>
        <SkeletonBox width={52} height={52} borderRadius={radii.full} />
      </View>

      {/* Summary card */}
      <SkeletonBox height={160} borderRadius={radii.xl} style={{ width: '100%' }} />

      {/* Quick actions row (4 cards) */}
      <View style={styles.cardsRow}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBox key={i} height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        ))}
      </View>

      {/* Children section header */}
      <SkeletonBox width={60} height={18} style={{ alignSelf: 'flex-start' }} />

      {/* Children cards */}
      {Array.from({ length: 2 }, (_, i) => (
        <SkeletonBox key={i} height={72} borderRadius={radii.xl} style={{ width: '100%' }} />
      ))}
    </View>
  );
}

export function ListScreenSkeleton() {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} style={styles.cardSkeleton}>
          <View style={styles.cardTopSkeleton}>
            <SkeletonBox width="60%" height={18} />
            <SkeletonBox width={50} height={22} borderRadius={radii.sm} />
          </View>
          <SkeletonBox width="40%" height={12} />
          <SkeletonBox width="30%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: spacing['6'],
    gap: spacing['4'],
  },
  heroSkeleton: {
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing['2'],
  },
  adminHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  adminHeroText: {
    gap: spacing['1'],
  },
  cardsRow: {
    flexDirection: 'row',
    gap: spacing['3'],
    width: '100%',
  },
  listContainer: {
    flex: 1,
    padding: spacing['4'],
    gap: spacing['3'],
  },
  cardSkeleton: {
    gap: spacing['2'],
    padding: spacing['4'],
  },
  cardTopSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
});
