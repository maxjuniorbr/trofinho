import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useMemo, useState } from 'react';
import {
  BellOff,
  ClipboardCheck,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';
import type { ThemeColors } from '@/constants/theme';
import type { Notif, NotifType, NotifGroup } from '@lib/notification-inbox';

// ── Type → visual mapping ────────────────────────────────

type TypeStyle = Readonly<{
  icon: LucideIcon;
  bgKey: keyof ThemeColors['semantic'];
  fgKey: keyof ThemeColors['semantic'];
}>;

const TYPE_STYLES: Record<NotifType, TypeStyle> = {
  task: { icon: ClipboardCheck, bgKey: 'infoBg', fgKey: 'info' },
  redemption: { icon: ShoppingBag, bgKey: 'warningBg', fgKey: 'warning' },
  penalty: { icon: AlertTriangle, bgKey: 'errorBg', fgKey: 'error' },
  appreciation: { icon: TrendingUp, bgKey: 'successBg', fgKey: 'success' },
};

// ── Filters ──────────────────────────────────────────────

type Filter = 'all' | 'actions';

type FilterDef = Readonly<{ key: Filter; label: string; count: number }>;

// ── Props ────────────────────────────────────────────────

type NotificationsScreenProps = Readonly<{
  items: Notif[];
  isLoading: boolean;
  onBack: () => void;
  onNavigate?: (route: string) => void;
}>;

export function NotificationsScreen({
  items,
  isLoading,
  onBack,
  onNavigate,
}: NotificationsScreenProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = useMemo(() => {
    if (filter === 'actions') return items.filter((n) => n.needsAction);
    return items;
  }, [items, filter]);

  const groups = useMemo(() => {
    const order: NotifGroup[] = ['Hoje', 'Ontem', 'Anterior'];
    const map: Record<NotifGroup, Notif[]> = { Hoje: [], Ontem: [], Anterior: [] };
    filtered.forEach((n) => map[n.group].push(n));
    return order.map((g) => [g, map[g]] as const).filter(([, arr]) => arr.length > 0);
  }, [filtered]);

  const actionsCount = items.filter((n) => n.needsAction).length;

  const filters: FilterDef[] = [
    { key: 'all', label: 'Todas', count: items.length },
    ...(actionsCount > 0
      ? [{ key: 'actions' as const, label: 'Pendências', count: actionsCount }]
      : []),
  ];

  const handlePress = (n: Notif) => {
    if (n.route && onNavigate) onNavigate(n.route);
  };

  return (
    <SafeScreenFrame bottomInset>
      <ScreenHeader title="Notificações" onBack={onBack} />

      {/* Filters — hidden when there are no items */}
      {items.length > 0 ? (
        <View style={styles.filtersRow}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${f.label}, ${f.count}`}
                style={[
                  styles.filterPill,
                  {
                    backgroundColor: active ? colors.accent.admin : colors.bg.muted,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.filterLabel,
                    { color: active ? colors.text.onBrand : colors.text.secondary },
                  ]}
                >
                  {f.label}
                </Text>
                {f.count > 0 ? (
                  <View
                    style={[
                      styles.filterBadge,
                      {
                        backgroundColor: active ? 'rgba(0,0,0,0.15)' : colors.bg.surface,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        { color: active ? colors.text.onBrand : colors.text.primary },
                      ]}
                    >
                      {f.count}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
      >
        {isLoading ? (
          <View style={{ paddingTop: 64, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={colors.accent.admin} />
          </View>
        ) : groups.length === 0 ? (
          <NotifEmptyState filter={filter} colors={colors} />
        ) : (
          groups.map(([group, list]) => (
            <View key={group} style={styles.group}>
              <Text style={[styles.groupLabel, { color: colors.text.muted }]}>{group}</Text>
              {list.map((n) => (
                <NotifCard
                  key={n.id}
                  notif={n}
                  colors={colors}
                  styles={styles}
                  onPress={() => handlePress(n)}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </SafeScreenFrame>
  );
}

// ── Notification card ────────────────────────────────────

type NotifCardProps = Readonly<{
  notif: Notif;
  colors: ThemeColors;
  styles: ReturnType<typeof makeStyles>;
  onPress: () => void;
}>;

function NotifCard({ notif, colors, styles, onPress }: NotifCardProps) {
  const typeStyle = TYPE_STYLES[notif.type];
  const Icon = typeStyle.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${notif.title}, ${notif.description}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.bg.surface,
          borderColor: colors.border.default,
        },
        shadows.card,
        pressed && { opacity: 0.85, transform: [{ scale: 0.985 }] },
      ]}
    >
      <View
        style={[styles.iconBox, { backgroundColor: colors.semantic[typeStyle.bgKey] as string }]}
      >
        <Icon size={20} color={colors.semantic[typeStyle.fgKey] as string} strokeWidth={2.4} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.titleRow}>
          <Text style={[styles.cardTitle, { color: colors.text.primary }]} numberOfLines={1}>
            {notif.title}
          </Text>
        </View>
        <Text style={[styles.cardDesc, { color: colors.text.secondary }]} numberOfLines={2}>
          {notif.description}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={[styles.cardTime, { color: colors.text.muted }]}>{notif.time}</Text>
          {notif.needsAction ? (
            <View style={[styles.actionBadge, { backgroundColor: colors.accent.adminBg }]}>
              <Text style={[styles.actionBadgeText, { color: colors.accent.adminDim }]}>
                REQUER AÇÃO
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

// ── Empty state ──────────────────────────────────────────

type EmptyProps = Readonly<{ filter: Filter; colors: ThemeColors }>;

function NotifEmptyState({ filter, colors }: EmptyProps) {
  const copyMap: Record<Filter, { title: string; desc: string }> = {
    actions: { title: 'Sem pendências', desc: 'Nenhuma aprovação aguardando você.' },
    all: { title: 'Sem notificações', desc: 'Você verá aqui as novidades da família.' },
  };
  const copy = copyMap[filter];

  return (
    <View style={emptyStyles.container}>
      <View style={[emptyStyles.iconBox, { backgroundColor: colors.bg.muted }]}>
        <BellOff size={28} color={colors.text.muted} strokeWidth={1.5} />
      </View>
      <Text style={[emptyStyles.title, { color: colors.text.primary }]}>{copy.title}</Text>
      <Text style={[emptyStyles.desc, { color: colors.text.secondary }]}>{copy.desc}</Text>
    </View>
  );
}

const emptyStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 64,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing['4'],
  },
  title: {
    fontFamily: typography.family.black,
    fontSize: typography.size.md,
  },
  desc: {
    fontFamily: typography.family.medium,
    fontSize: typography.size.sm,
    marginTop: spacing['1'],
    textAlign: 'center',
    maxWidth: 240,
  },
});

// ── Dynamic styles ───────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    filtersRow: {
      flexDirection: 'row',
      gap: spacing['2'],
      paddingHorizontal: spacing.screen,
      paddingVertical: spacing['3'],
    },
    filterPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['1.5'],
      paddingVertical: spacing['2'],
      borderRadius: radii.xl,
    },
    filterLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xs,
    },
    filterBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      fontFamily: typography.family.black,
      fontSize: typography.size.xxs,
    },
    listContent: {
      paddingHorizontal: spacing.screen,
      paddingBottom: spacing['6'],
    },
    group: {
      marginBottom: spacing['5'],
    },
    groupLabel: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: spacing['2'],
      paddingHorizontal: spacing['1'],
    },
    card: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing['3'],
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: 14,
      marginBottom: spacing['2'],
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardBody: { flex: 1, gap: spacing['0.5'] },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['2'],
    },
    cardTitle: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.sm,
      flex: 1,
    },
    cardDesc: {
      fontFamily: typography.family.medium,
      fontSize: typography.size.xs,
      lineHeight: typography.lineHeight.xs,
    },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['2'],
      marginTop: spacing['1'],
    },
    cardTime: {
      fontFamily: typography.family.semibold,
      fontSize: typography.size.xxs,
    },
    actionBadge: {
      paddingHorizontal: spacing['2'],
      paddingVertical: 2,
      borderRadius: radii.full,
    },
    actionBadgeText: {
      fontFamily: typography.family.bold,
      fontSize: typography.size.xxs,
      letterSpacing: 0.5,
    },
  });
}
