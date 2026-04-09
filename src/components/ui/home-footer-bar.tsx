import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context/theme-context';
import { spacing, typography } from '@/constants/theme';
import type { LucideIcon } from 'lucide-react-native';

export type FooterItem = Readonly<{
  icon: LucideIcon;
  label: string;
  rota: string;
  badge?: number;
}>;

type HomeFooterBarProps = Readonly<{
  items: readonly FooterItem[];
  activeRoute: string;
  onNavigate: (rota: string) => void;
}>;

export const FOOTER_BAR_HEIGHT = 56;

export function HomeFooterBar({ items, activeRoute, onNavigate }: HomeFooterBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.bg.surface,
          borderTopColor: colors.border.subtle,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      {items.map(({ icon: Icon, label, rota, badge }) => {
        const active = rota === activeRoute;
        const iconColor = active ? colors.accent.admin : colors.text.muted;
        const labelColor = active ? colors.accent.admin : colors.text.muted;

        return (
          <Pressable
            key={rota}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
            onPress={() => onNavigate(rota)}
            accessibilityRole="button"
            accessibilityLabel={badge && badge > 0 ? `${label}, ${badge} pendentes` : label}
            accessibilityState={{ selected: active }}
          >
            <View style={styles.iconContainer}>
              <Icon size={22} color={iconColor} strokeWidth={active ? 2 : 1.5} />
              {badge != null && badge > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.semantic.error }]}>
                  <Text style={[styles.badgeText, { color: colors.text.inverse }]}>{badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
            {active ? (
              <View style={[styles.dot, { backgroundColor: colors.accent.admin }]} />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing['2'],
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: spacing['0.5'],
    paddingVertical: spacing['1'],
  },
  tabPressed: { opacity: 0.6 },
  iconContainer: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['0.5'],
  },
  badgeText: {
    fontFamily: typography.family.black,
    fontSize: typography.size.xxs,
    fontVariant: ['tabular-nums'],
  },
  label: {
    fontFamily: typography.family.semibold,
    fontSize: typography.size.xxs,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: spacing['0.5'],
  },
});
