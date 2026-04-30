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

function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = radii.md,
  style,
}: SkeletonProps) {
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
      style={[{ width, height, borderRadius, backgroundColor: colors.bg.muted, opacity }, style]}
    />
  );
}

// ── Child home ───────────────────────────────────────────

export function HomeScreenSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      {/* Hero: greeting left + bell right */}
      <View style={styles.heroRow}>
        <View style={styles.heroTextCol}>
          <SkeletonBox width={100} height={14} />
          <SkeletonBox width={160} height={28} style={{ marginTop: spacing['1'] }} />
        </View>
        <SkeletonBox width={40} height={40} borderRadius={radii.full} />
      </View>

      {/* Summary card (navy gradient) */}
      <SkeletonBox height={210} borderRadius={radii.xl} />

      {/* Quick actions row (4 cards) */}
      <View style={styles.cardsRow}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBox key={i} height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        ))}
      </View>

      {/* Task list section header */}
      <SkeletonBox width={140} height={16} style={{ alignSelf: 'flex-start' }} />

      {/* Task cards */}
      {Array.from({ length: 2 }, (_, i) => (
        <ListCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Admin home ───────────────────────────────────────────

export function AdminHomeScreenSkeleton() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      {/* Hero: greeting + name left, bell right */}
      <View style={styles.heroRow}>
        <View style={styles.heroTextCol}>
          <SkeletonBox width={100} height={14} />
          <SkeletonBox width={200} height={28} style={{ marginTop: spacing['1'] }} />
        </View>
        <SkeletonBox width={40} height={40} borderRadius={radii.full} />
      </View>

      {/* Summary card */}
      <SkeletonBox height={200} borderRadius={radii.xl} style={{ width: '100%' }} />

      {/* Quick actions row (4 cards) */}
      <View style={styles.cardsRow}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonBox key={i} height={88} borderRadius={radii.xl} style={{ flex: 1 }} />
        ))}
      </View>

      {/* Children section header */}
      <SkeletonBox width={60} height={16} style={{ alignSelf: 'flex-start' }} />

      {/* Children cards */}
      {Array.from({ length: 2 }, (_, i) => (
        <View key={i} style={styles.childCardSkeleton}>
          <SkeletonBox width={40} height={40} borderRadius={radii.full} />
          <View style={styles.childCardInfo}>
            <SkeletonBox width="60%" height={14} />
            <SkeletonBox width="40%" height={10} />
          </View>
          <SkeletonBox width={48} height={20} borderRadius={radii.sm} />
        </View>
      ))}
    </View>
  );
}

// ── List screens (tasks, prizes, redemptions, etc.) ──────

// Avatar/icon size used in list-card skeletons; kept as a local constant
// because it must match the SkeletonBox width below for alignment.
const LIST_CARD_AVATAR_SIZE = 36;

function ListCardSkeleton() {
  return (
    <View style={styles.listCard}>
      <View style={styles.listCardTopRow}>
        <SkeletonBox
          width={LIST_CARD_AVATAR_SIZE}
          height={LIST_CARD_AVATAR_SIZE}
          borderRadius={radii.full}
        />
        <View style={styles.listCardInfo}>
          <SkeletonBox width="70%" height={14} />
          <SkeletonBox width="45%" height={11} />
        </View>
        <SkeletonBox width={50} height={22} borderRadius={radii.sm} />
      </View>
      <View style={styles.listCardBadgeRow}>
        <SkeletonBox width={64} height={18} borderRadius={radii.sm} />
        <SkeletonBox width={48} height={18} borderRadius={radii.sm} />
      </View>
    </View>
  );
}

export function ListScreenSkeleton() {
  return (
    <View style={styles.listContainer}>
      {Array.from({ length: 4 }, (_, i) => (
        <ListCardSkeleton key={i} />
      ))}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing['6'],
    gap: spacing['4'],
  },

  // Hero (shared between child and admin home)
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  heroTextCol: {
    flex: 1,
  },

  // Quick actions
  cardsRow: {
    flexDirection: 'row',
    gap: spacing['3'],
    width: '100%',
  },

  // Admin children cards
  childCardSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
    width: '100%',
    padding: spacing['3'] + spacing['0.5'],
  },
  childCardInfo: {
    flex: 1,
    gap: spacing['1.5'],
  },

  // List screen cards
  listContainer: {
    flex: 1,
    padding: spacing['4'],
    gap: spacing['3'],
  },
  listCard: {
    gap: spacing['3'],
    padding: spacing['4'],
  },
  listCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  listCardInfo: {
    flex: 1,
    gap: spacing['1.5'],
  },
  listCardBadgeRow: {
    flexDirection: 'row',
    gap: spacing['2'],
    paddingLeft: LIST_CARD_AVATAR_SIZE + spacing['3'], // align with text after icon
  },
});
