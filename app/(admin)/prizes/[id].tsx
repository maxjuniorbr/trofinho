import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useState, useCallback, useMemo } from 'react';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  getPrize,
  updatePrize,
  deactivatePrize,
  reactivatePrize,
  type Prize,
} from '@lib/prizes';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { PrizeFormFields } from '@/components/prizes/prize-form-fields';

export default function AdminPrizeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [prize, setPrize] = useState<Prize | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [togglingActive, setTogglingActive] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const { data, error } = await getPrize(id);
    if (error) {
      setError(error);
    } else if (data) {
      setPrize(data);
      setName(data.nome);
      setDescription(data.descricao ?? '');
      setCostStr(String(data.custo_pontos));
    }
    setLoading(false);
  }, [id]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  async function handleSave() {
    setFormError(null);
    setSuccess(null);
    if (!name.trim()) return setFormError('Informe o nome do prêmio.');
    const cost = Number.parseInt(costStr, 10);
    if (Number.isNaN(cost) || cost <= 0) return setFormError('Custo em pontos deve ser um número maior que zero.');
    setSaving(true);
    const { error } = await updatePrize(id, { nome: name.trim(), descricao: description.trim() || null, custo_pontos: cost });
    setSaving(false);
    if (error) return setFormError(error);
    setSuccess('Prêmio atualizado!');
    loadData();
  }

  async function handleToggleActive() {
    if (!prize) return;
    setTogglingActive(true);
    setFormError(null);
    setSuccess(null);
    const { error } = prize.ativo ? await deactivatePrize(id) : await reactivatePrize(id);
    setTogglingActive(false);
    if (error) return setFormError(error);
    loadData();
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ActivityIndicator size="large" color={colors.accent.admin} />
      </View>
    );
  }

  if (error || !prize) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg.canvas }]}>
        <StatusBar style={colors.statusBar} />
        <ScreenHeader title="Prêmio" onBack={() => router.back()} />
        <EmptyState error={error ?? 'Prêmio não encontrado.'} onRetry={loadData} />
      </View>
    );
  }

  let toggleActiveLabel = 'Reativar prêmio';

  if (togglingActive) {
    toggleActiveLabel = 'Aguarde…';
  } else if (prize.ativo) {
    toggleActiveLabel = 'Desativar prêmio';
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg.canvas }} behavior="padding">
      <StatusBar style={colors.statusBar} />
      <ScreenHeader title="Editar Prêmio" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {!prize.ativo && (
          <View style={styles.avisoInativo}>
            <Text style={styles.avisoInativoTexto}>
              Este prêmio está inativo e não aparece para os filhos.
            </Text>
          </View>
        )}

        <PrizeFormFields
          name={name}
          description={description}
          cost={costStr}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onCostChange={setCostStr}
        />

        {formError ? <Text style={styles.erroTexto}>{formError}</Text> : null}
        {success ? <Text style={styles.sucessoTexto}>{success}</Text> : null}

        <Pressable
          style={({ pressed }) => [styles.botao, saving && styles.botaoDesabilitado, pressed && !saving && { opacity: 0.85 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.botaoTexto}>{saving ? 'Salvando…' : 'Salvar alterações'}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.botaoSecundario, togglingActive && styles.botaoDesabilitado, pressed && !togglingActive && { opacity: 0.85 }]}
          onPress={handleToggleActive}
          disabled={togglingActive}
        >
          <Text style={[styles.botaoSecundarioTexto, !prize.ativo && { color: colors.semantic.success }]}>
            {toggleActiveLabel}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
    scroll: { padding: spacing['6'], gap: spacing['5'], flexGrow: 1 },
    avisoInativo: { backgroundColor: colors.semantic.warningBg, borderRadius: radii.lg, borderCurve: 'continuous', padding: spacing['3'] },
    avisoInativoTexto: { fontSize: typography.size.xs, color: colors.semantic.warning, textAlign: 'center' },
    erroTexto: { color: colors.semantic.error, fontSize: typography.size.sm, fontFamily: typography.family.medium },
    sucessoTexto: { color: colors.semantic.success, fontSize: typography.size.sm, fontFamily: typography.family.semibold },
    botao: { backgroundColor: colors.accent.adminDim, borderRadius: radii.xl, borderCurve: 'continuous', paddingVertical: spacing['3'], alignItems: 'center', marginTop: spacing['1'], minHeight: 48 },
    botaoDesabilitado: { opacity: 0.55 },
    botaoTexto: { color: colors.text.inverse, fontFamily: typography.family.bold, fontSize: typography.size.md },
    botaoSecundario: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1.5,
      borderColor: colors.semantic.error,
      paddingVertical: spacing['3'],
      alignItems: 'center',
      minHeight: 48,
    },
    botaoSecundarioTexto: { color: colors.semantic.error, fontFamily: typography.family.bold, fontSize: typography.size.md },
  });
}
