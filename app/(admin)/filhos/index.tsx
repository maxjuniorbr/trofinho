import { StyleSheet, Text, View, Pressable, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Avatar } from '@/components/ui/avatar';
import { listarFilhos } from '@lib/filhos';
import type { Filho } from '@lib/tarefas';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';

export default function AdminFilhosScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    try {
      const { data, error } = await listarFilhos();
      if (error) setErro(error); else setFilhos(data);
    } catch { setErro('Não foi possível carregar os filhos agora.'); setFilhos([]); }
    finally { setCarregando(false); }
  }, []);

  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  return (
    <View style={[styles.container, { backgroundColor: colors.bg.canvas }]}>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        onBack={() => router.back()}
        backLabel="← Início"
        rightAction={
          <Pressable onPress={() => router.push('/(admin)/filhos/novo')} style={[styles.botaoNovo, { backgroundColor: colors.accent.admin }]}>
            <Text style={[styles.botaoNovoTexto, { color: colors.text.inverse }]}>+ Novo</Text>
          </Pressable>
        }
      />

      {(carregando || erro || filhos.length === 0) ? (
        <EmptyState loading={carregando} error={erro} empty={filhos.length === 0} emptyMessage={'Nenhum filho cadastrado.\nToque em "+ Novo" para cadastrar o primeiro filho.'} onRetry={carregar} />
      ) : (
        <FlatList
          data={filhos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.lista}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.bg.surface, borderColor: colors.border.subtle, boxShadow: colors.shadow.low }]}>
              <Avatar name={item.nome} size={44} />
              <View style={styles.cardInfo}>
                <Text style={[styles.cardNome, { color: colors.text.primary }]}>{item.nome}</Text>
                <Text style={[styles.cardStatus, { color: item.usuario_id ? colors.semantic.success : colors.semantic.warning }]}>
                  {item.usuario_id ? '✓ Conta vinculada' : '⚠ Sem conta'}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1 },
    botaoNovo: { borderRadius: radii.sm, paddingVertical: spacing['1'] + 2, paddingHorizontal: spacing['3'] },
    botaoNovoTexto: { fontSize: typography.size.sm, fontWeight: typography.weight.semibold },
    lista: { padding: spacing['4'], gap: 10 },
    card: { borderRadius: radii.lg, borderWidth: 1, padding: spacing['3'], flexDirection: 'row', alignItems: 'center' },
    cardInfo: { flex: 1, marginLeft: spacing['3'] },
    cardNome: { fontSize: typography.size.md, fontWeight: typography.weight.semibold },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['1'] },
  });
}
