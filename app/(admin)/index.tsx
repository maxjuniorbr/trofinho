import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarTarefasAdmin } from '@lib/tarefas';
import { listarFilhos } from '@lib/filhos';
import { listarSaldosAdmin } from '@lib/saldos';

type Familia = { nome: string };

export default function AdminHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [qtdValidar, setQtdValidar] = useState(0);
  const [qtdFilhos, setQtdFilhos] = useState(0);
  const [totalPontos, setTotalPontos] = useState(0);

  const carregar = useCallback(async () => {
    setCarregando(true);

    try {
      const p = await buscarPerfil();
      setProfile(p);

      if (p?.familia_id) {
        const { data: fam } = await supabase
          .from('familias')
          .select('nome')
          .eq('id', p.familia_id)
          .single();
        setFamilia(fam);
      } else {
        setFamilia(null);
      }

      const { data: tarefas } = await listarTarefasAdmin();
      const total = tarefas.reduce(
        (acc, t) =>
          acc +
          t.atribuicoes.filter((a) => a.status === 'aguardando_validacao').length,
        0
      );
      setQtdValidar(total);

      const { data: filhos } = await listarFilhos();
      setQtdFilhos(filhos.length);

      const { data: saldos } = await listarSaldosAdmin();
      setTotalPontos(saldos.reduce((acc, s) => acc + s.saldo_livre + s.cofrinho, 0));
    } catch {
      setFamilia(null);
      setQtdValidar(0);
      setQtdFilhos(0);
      setTotalPontos(0);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const tarefasPendentesTexto = (() => {
    if (qtdValidar === 0) {
      return 'Crie tarefas e acompanhe o progresso dos filhos.';
    }

    const tarefaLabel = qtdValidar === 1 ? 'tarefa' : 'tarefas';
    return `${qtdValidar} ${tarefaLabel} aguardando validação.`;
  })();

  const filhosTexto = (() => {
    if (qtdFilhos === 0) {
      return 'Cadastre os filhos da família.';
    }

    if (qtdFilhos === 1) {
      return '1 filho cadastrado.';
    }

    return `${qtdFilhos} filhos cadastrados.`;
  })();

  async function handleSair() {
    setSaindo(true);
    await signOut();
  }

  if (carregando) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.emoji}>👑</Text>
        <Text style={styles.familia}>{familia?.nome ?? '—'}</Text>
        <Text style={styles.boas_vindas}>Olá, {profile?.nome ?? 'Admin'}!</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(admin)/tarefas')}
        accessibilityRole="button"
        accessibilityLabel={`Tarefas. ${tarefasPendentesTexto}`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>📋 Tarefas</Text>
          {qtdValidar > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{qtdValidar}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTexto}>
          {tarefasPendentesTexto}
        </Text>
        <Text style={styles.cardLink}>Ver tarefas →</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(admin)/filhos')}
        accessibilityRole="button"
        accessibilityLabel={`Filhos. ${filhosTexto}`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>👨‍👧 Filhos</Text>
          {qtdFilhos > 0 && (
            <View style={[styles.badge, { backgroundColor: '#10B981' }]}>
              <Text style={styles.badgeTexto}>{qtdFilhos}</Text>
            </View>
          )}
        </View>
        <Text style={styles.cardTexto}>
          {filhosTexto}
        </Text>
        <Text style={styles.cardLink}>Gerenciar filhos →</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(admin)/saldos')}
        accessibilityRole="button"
        accessibilityLabel="Pontos e Cofrinho"
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>💰 Pontos & Cofrinho</Text>
        </View>
        <Text style={styles.cardTexto}>
          {totalPontos > 0
            ? `${totalPontos} pontos distribuídos na família.`
            : 'Gerencie valorização e penalizações dos filhos.'}
        </Text>
        <Text style={styles.cardLink}>Ver saldos →</Text>
      </Pressable>

      <Pressable
        style={({ pressed }) => [
          styles.botaoSair,
          saindo && styles.botaoDesabilitado,
          pressed && !saindo && { opacity: 0.7 },
        ]}
        onPress={handleSair}
        disabled={saindo}
        accessibilityRole="button"
        accessibilityLabel={saindo ? 'Saindo' : 'Sair'}
        accessibilityState={{ disabled: saindo, busy: saindo }}
      >
        <Text style={styles.botaoSairTexto}>{saindo ? 'Saindo…' : 'Sair'}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' },
  container: {
    flexGrow: 1,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  emoji: { fontSize: 48 },
  familia: {
    fontSize: 24,
    fontWeight: '700',
    color: '#4F46E5',
    marginTop: 12,
  },
  boas_vindas: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderCurve: 'continuous',
    padding: 24,
    width: '100%',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    marginBottom: 32,
  },
  cardTopo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitulo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4F46E5',
    flex: 1,
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  cardTexto: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  cardLink: {
    fontSize: 14,
    color: '#4F46E5',
    fontWeight: '600',
    marginTop: 10,
  },
  botaoSair: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    borderCurve: 'continuous',
    paddingVertical: 14,
    paddingHorizontal: 32,
    minHeight: 44,
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoSairTexto: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
