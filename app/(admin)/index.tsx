import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useEffect, useCallback } from 'react';
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
    // _layout.tsx detecta a mudança de sessão e redireciona automaticamente
  }

  if (carregando) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.emoji}>👑</Text>
        <Text style={styles.familia}>{familia?.nome ?? '—'}</Text>
        <Text style={styles.boas_vindas}>Olá, {profile?.nome ?? 'Admin'}!</Text>
      </View>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(admin)/tarefas')}
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
          {qtdValidar > 0
            ? `${qtdValidar} tarefa${qtdValidar > 1 ? 's' : ''} aguardando validação.`
            : 'Crie tarefas e acompanhe o progresso dos filhos.'}
        </Text>
        <Text style={styles.cardLink}>Ver tarefas →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(admin)/filhos')}
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
          {qtdFilhos === 0
            ? 'Cadastre os filhos da família.'
            : `${qtdFilhos} filho${qtdFilhos > 1 ? 's' : ''} cadastrado${qtdFilhos > 1 ? 's' : ''}.`}
        </Text>
        <Text style={styles.cardLink}>Gerenciar filhos →</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(admin)/saldos')}
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F5F3FF' },
  container: {
    flex: 1,
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
    color: '#4F46E5',
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
    color: '#4F46E5',
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
