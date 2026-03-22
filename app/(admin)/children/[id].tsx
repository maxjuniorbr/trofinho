import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getChild, type AdminChildProfile } from '@lib/children';
import { Avatar } from '@/components/ui/avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useTheme } from '@/context/theme-context';
import { radii, spacing } from '@/constants/theme';
import { getSafeBottomPadding } from '@lib/safe-area';

export default function AdminChildDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => makeStyles(), []);

  const [child, setChild] = useState<AdminChildProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: childError } = await getChild(id);

      if (childError || !data) {
        setError(childError ?? 'Não foi possível carregar o filho.');
        setChild(null);
        return;
      }

      setChild(data);
    } catch {
      setError('Não foi possível carregar o filho agora.');
      setChild(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    loadData();
  }, [loadData]));

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !child) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Dados do Filho" onBack={() => router.back()} backLabel="Filhos" />
        <View style={styles.center}>
          <EmptyState error={error ?? 'Filho não encontrado.'} onRetry={loadData} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Dados do Filho" onBack={() => router.back()} backLabel="Filhos" />

      <ScrollView
        style={{ backgroundColor: colors.bg.canvas }}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: getSafeBottomPadding(insets, spacing['10']) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.identityCard, { backgroundColor: colors.bg.surface, borderColor: colors.border.default }]}>
          <Avatar name={child.nome} size={88} imageUri={child.avatar_url} />
        </View>

        <Input
          label="Nome"
          value={child.nome}
          editable={false}
          accessibilityLabel="Nome do filho"
        />

        <Input
          label="E-mail"
          value={child.email ?? 'Sem conta vinculada'}
          editable={false}
          accessibilityLabel="E-mail do filho"
        />
      </ScrollView>
    </View>
  );
}

function makeStyles() {
  return StyleSheet.create({
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing['6'],
    },
    container: {
      flex: 1,
    },
    scrollContent: {
      padding: spacing['5'],
      paddingBottom: spacing['10'],
      gap: spacing['4'],
    },
    identityCard: {
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      padding: spacing['5'],
    },
  });
}
