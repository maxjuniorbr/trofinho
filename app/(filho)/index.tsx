import { StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useRouter, useFocusEffect } from 'expo-router';
import { signOut, buscarPerfil, type UserProfile } from '@lib/auth';
import { supabase } from '@lib/supabase';
import { listarAtribuicoesFilho } from '@lib/tarefas';
import { buscarSaldo } from '@lib/saldos';

type Familia = { nome: string };

export default function FilhoHomeScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [pendentes, setPendentes] = useState(0);
  const [saldoLivre, setSaldoLivre] = useState(0);
  const [cofrinho, setCofrinho] = useState(0);

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

      const { data: atribuicoes } = await listarAtribuicoesFilho();
      setPendentes(atribuicoes.filter((a) => a.status === 'pendente').length);

      const { data: s } = await buscarSaldo();
      setSaldoLivre(s?.saldo_livre ?? 0);
      setCofrinho(s?.cofrinho ?? 0);
    } catch {
      setFamilia(null);
      setPendentes(0);
      setSaldoLivre(0);
      setCofrinho(0);
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
    if (pendentes === 0) {
      return 'Nenhuma tarefa pendente no momento.';
    }

    const tarefaLabel = pendentes === 1 ? 'tarefa pendente' : 'tarefas pendentes';
    return `${pendentes} ${tarefaLabel} esperando por você!`;
  })();

  async function handleSair() {
    setSaindo(true);
    await signOut();
  }

  if (carregando) {
    return (
      <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.emoji}>⭐</Text>
        <Text style={styles.familia}>{familia?.nome ?? '—'}</Text>
        <Text style={styles.boas_vindas}>Olá, {profile?.nome ?? 'Filho'}!</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
        onPress={() => router.push('/(filho)/tarefas')}
        accessibilityRole="button"
        accessibilityLabel={`Minhas Tarefas. ${tarefasPendentesTexto}`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>📋 Minhas Tarefas</Text>
          {pendentes > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeTexto}>{pendentes}</Text>
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
        onPress={() => router.push('/(filho)/saldo')}
        accessibilityRole="button"
        accessibilityLabel={`Meu Saldo. ${saldoLivre} pontos livre, ${cofrinho} pontos cofrinho`}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>💰 Meu Saldo</Text>
        </View>
        <Text style={styles.cardTexto}>
          💰 {saldoLivre} pts livre{' · '}🐷 {cofrinho} pts cofrinho
        </Text>
        <Text style={styles.cardLink}>Ver detalhes →</Text>
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF' },
  container: {
    flexGrow: 1,
    backgroundColor: '#F0F9FF',
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
    color: '#0EA5E9',
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
    color: '#0EA5E9',
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
    color: '#0EA5E9',
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
