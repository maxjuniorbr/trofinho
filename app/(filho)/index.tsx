import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
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
    const p = await buscarPerfil();
    setProfile(p);

    if (p?.familia_id) {
      const { data: fam } = await supabase
        .from('familias')
        .select('nome')
        .eq('id', p.familia_id)
        .single();
      setFamilia(fam);
    }

    const { data: atribuicoes } = await listarAtribuicoesFilho();
    setPendentes(atribuicoes.filter((a) => a.status === 'pendente').length);

    const { data: s } = await buscarSaldo();
    setSaldoLivre(s?.saldo_livre ?? 0);
    setCofrinho(s?.cofrinho ?? 0);
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function handleSair() {
    setSaindo(true);
    await signOut();
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0EA5E9" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.emoji}>⭐</Text>
        <Text style={styles.familia}>{familia?.nome ?? '—'}</Text>
        <Text style={styles.boas_vindas}>Olá, {profile?.nome ?? 'Filho'}!</Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(filho)/tarefas')}
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
          {pendentes > 0
            ? `${pendentes} tarefa${pendentes > 1 ? 's' : ''} pendente${pendentes > 1 ? 's' : ''} esperando por você!`
            : 'Nenhuma tarefa pendente no momento.'}
        </Text>
        <Text style={styles.cardLink}>Ver tarefas →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(filho)/saldo')}
      >
        <View style={styles.cardTopo}>
          <Text style={styles.cardTitulo}>💰 Meu Saldo</Text>
        </View>
        <Text style={styles.cardTexto}>
          💰 {saldoLivre} pts livre{' · '}🐷 {cofrinho} pts cofrinho
        </Text>
        <Text style={styles.cardLink}>Ver detalhes →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.botaoSair, saindo && styles.botaoDesabilitado]}
        onPress={handleSair}
        disabled={saindo}
      >
        <Text style={styles.botaoSairTexto}>{saindo ? 'Saindo…' : 'Sair'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F9FF' },
  container: {
    flex: 1,
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
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeTexto: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  botaoDesabilitado: { opacity: 0.5 },
  botaoSairTexto: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '500',
  },
});
