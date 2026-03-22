import { StyleSheet, Text, View, Pressable, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { Eye, Plus } from 'lucide-react-native';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { listChildren } from '@lib/children';
import { listAdminBalances, type BalanceWithChild } from '@lib/balances';
import type { Child } from '@lib/tasks';
import { useTheme } from '@/context/theme-context';
import { radii, shadows, spacing, typography } from '@/constants/theme';

export default function AdminChildrenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(), []);

  const [children, setChildren] = useState<Child[]>([]);
  const [balancesMap, setBalancesMap] = useState<Map<string, BalanceWithChild>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: childrenData, error: childrenError }, { data: balancesData, error: balancesError }] =
        await Promise.all([listChildren(), listAdminBalances()]);
      if (childrenError) {
        setError(childrenError);
      } else {
        setChildren(childrenData);
        if (!balancesError) {
          setBalancesMap(new Map(balancesData.map((s) => [s.filho_id, s])));
        }
      }
    } catch { setError('Não foi possível carregar os filhos agora.'); setChildren([]); }
    finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        onBack={() => router.back()}
        backLabel="Início"
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => router.push('/(admin)/children/new')}
            accessibilityLabel="Cadastrar filho"
          />
        }
      />

      {(loading || error || children.length === 0) ? (
        <EmptyState loading={loading} error={error} empty={children.length === 0} emptyMessage={'Nenhum filho cadastrado.\nToque em "+" para cadastrar o primeiro filho.'} onRetry={loadData} />
      ) : (
        <FlatList
          data={children}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} tintColor={colors.brand.vivid} />}
          renderItem={({ item }) => {
            const balance = balancesMap.get(item.id);
            return (
              <View style={[styles.card, shadows.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle }]}>
                <Pressable
                  style={styles.cardMain}
                  onPress={() => router.push(`/(admin)/children/${item.id}` as never)}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.nome}, ver nome e e-mail`}
                >
                  <Avatar name={item.nome} size={44} imageUri={item.avatar_url} />
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardNome, { color: colors.text.primary }]}>{item.nome}</Text>
                    <Text style={[styles.cardStatus, { color: item.usuario_id ? colors.semantic.success : colors.semantic.warning }]}>
                      {item.usuario_id ? 'Conta vinculada' : 'Sem conta'}
                    </Text>
                    {balance ? (
                      <Text style={[styles.cardSaldo, { color: colors.text.secondary }]}>
                        {balance.saldo_livre} livre · {balance.cofrinho} cofrinho
                      </Text>
                    ) : null}
                  </View>
                </Pressable>

                <HeaderIconButton
                  icon={Eye}
                  onPress={() => router.push(`/(admin)/children/${item.id}` as never)}
                  accessibilityLabel={`Ver dados de ${item.nome}`}
                />
              </View>
            );
          }}
        />
      )}
    </SafeScreenFrame>
  );
}

function makeStyles() {
  return StyleSheet.create({
    container: { flex: 1 },
    lista: { padding: spacing['4'], gap: spacing['3'], paddingBottom: spacing['12'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['3'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['3'],
    },
    cardMain: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: spacing['3'] },
    cardNome: { fontSize: typography.size.md, fontFamily: typography.family.semibold },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['1'] },
    cardSaldo: { fontSize: typography.size.xs, marginTop: spacing['1'] },
  });
}
