import {
  StyleSheet,
  Text,
  View,
  Pressable,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncListState from '@/components/AsyncListState';
import {
  listarPremiosAtivos,
  solicitarResgate,
  type Premio,
} from '@lib/premios';
import { buscarSaldo } from '@lib/saldos';

export default function FilhoPremiosScreen() {
  const [premios, setPremios] = useState<Premio[]>([]);
  const [saldoLivre, setSaldoLivre] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [resgatando, setResgatando] = useState<string | null>(null);
  const [erroResgate, setErroResgate] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    setErroResgate(null);
    setSucesso(null);
    try {
      const [{ data: listaPremios, error: erroPremios }, { data: saldo, error: erroSaldo }] =
        await Promise.all([listarPremiosAtivos(), buscarSaldo()]);

      if (erroPremios) {
        setErro(erroPremios);
      } else {
        setPremios(listaPremios);
      }

      setSaldoLivre(saldo?.saldo_livre ?? 0);

      if (erroSaldo && !erroPremios) {
        setErro(erroSaldo);
      }
    } catch {
      setErro('Não foi possível carregar os prêmios agora.');
      setPremios([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  async function handleResgatar(premio: Premio) {
    setErroResgate(null);
    setSucesso(null);
    setResgatando(premio.id);

    const { error } = await solicitarResgate(premio.id);
    setResgatando(null);

    if (error) {
      setErroResgate(error);
    } else {
      setSucesso(`Resgate de "${premio.nome}" solicitado! Aguarde a confirmação.`);
      // Atualiza saldo localmente
      setSaldoLivre((prev) => prev - premio.custo_pontos);
    }
  }

  function renderConteudo() {
    if (carregando || erro || premios.length === 0) {
      return (
        <AsyncListState
          loading={carregando}
          error={erro}
          empty={premios.length === 0}
          emptyMessage={'Nenhum prêmio disponível no momento.\nPergunte ao responsável!'}
          onRetry={carregar}
        />
      );
    }

    return (
      <FlatList
        data={premios}
        keyExtractor={(item) => item.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.lista}
        ListHeaderComponent={
          <>
            <View style={styles.saldoBanner}>
              <Text style={styles.saldoLabel}>Seu saldo disponível</Text>
              <Text style={styles.saldoValor}>💰 {saldoLivre} pts</Text>
            </View>
            {erroResgate ? (
              <Text style={styles.erroTexto} accessibilityRole="alert">{erroResgate}</Text>
            ) : null}
            {sucesso ? (
              <Text style={styles.sucessoTexto}>{sucesso}</Text>
            ) : null}
          </>
        }
        renderItem={({ item }) => {
          const temSaldo = saldoLivre >= item.custo_pontos;
          const isResgatando = resgatando === item.id;

          return (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardNome}>{item.nome}</Text>
                {item.descricao ? (
                  <Text style={styles.cardDescricao} numberOfLines={2}>{item.descricao}</Text>
                ) : null}
                <Text style={styles.cardCusto}>🏆 {item.custo_pontos} pts</Text>
                {!temSaldo && (
                  <Text style={styles.textoSemSaldo}>
                    Faltam {item.custo_pontos - saldoLivre} pts
                  </Text>
                )}
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.botaoResgatar,
                  (!temSaldo || isResgatando || resgatando !== null) && styles.botaoDesabilitado,
                  pressed && temSaldo && !resgatando && { opacity: 0.85 },
                ]}
                onPress={() => handleResgatar(item)}
                disabled={!temSaldo || resgatando !== null}
                accessibilityRole="button"
                accessibilityLabel={
                  !temSaldo
                    ? `Saldo insuficiente para ${item.nome}`
                    : `Resgatar ${item.nome}`
                }
                accessibilityState={{ disabled: !temSaldo || resgatando !== null }}
              >
                {isResgatando ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.botaoResgatarTexto}>
                    {temSaldo ? 'Resgatar' : 'Sem saldo'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      {renderConteudo()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9FF' },
  lista: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },
  saldoBanner: {
    backgroundColor: '#0EA5E9',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    alignItems: 'center',
    marginBottom: 4,
    gap: 4,
  },
  saldoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '500',
  },
  saldoValor: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  erroTexto: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  sucessoTexto: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderCurve: 'continuous',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
  },
  cardInfo: {
    flex: 1,
    gap: 3,
  },
  cardNome: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E1B4B',
  },
  cardDescricao: {
    fontSize: 13,
    color: '#6B7280',
  },
  cardCusto: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0EA5E9',
  },
  textoSemSaldo: {
    fontSize: 12,
    color: '#EF4444',
  },
  botaoResgatar: {
    backgroundColor: '#0EA5E9',
    borderRadius: 10,
    borderCurve: 'continuous',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 88,
  },
  botaoDesabilitado: {
    backgroundColor: '#BAE6FD',
  },
  botaoResgatarTexto: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
