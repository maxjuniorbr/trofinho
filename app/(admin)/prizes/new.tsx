import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { setNavigationFeedback } from '@lib/navigation-feedback';
import { useTheme } from '@/context/theme-context';
import { spacing } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PrizeFormFields } from '@/components/prizes/prize-form-fields';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { useCreatePrize } from '@/hooks/queries';

export default function NewPrizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const createPrizeMutation = useCreatePrize();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCreate = () => {
    setError(null);
    if (!name.trim()) return setError('Informe o nome do prêmio.');
    const cost = Number.parseInt(costStr, 10);
    if (Number.isNaN(cost) || cost <= 0) return setError('Custo em pontos deve ser um número maior que zero.');

    createPrizeMutation.mutate(
      { nome: name.trim(), descricao: description.trim() || null, custo_pontos: cost },
      {
        onSuccess: () => {
          setNavigationFeedback('admin-prize-list', 'Prêmio criado com sucesso.');
          router.dismissTo('/(admin)/prizes');
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  };

  return (
    <StickyFooterScreen
      title="Novo Prêmio"
      onBack={() => router.back()}
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={(
        <FormFooter message={error} compact includeSafeBottom={false}>
          <Button
            label="Criar prêmio"
            loadingLabel="Criando…"
            onPress={handleCreate}
            loading={createPrizeMutation.isPending}
            accessibilityLabel="Criar prêmio"
          />
        </FormFooter>
      )}
    >
      <StatusBar style={colors.statusBar} />
      <PrizeFormFields
        name={name}
        description={description}
        cost={costStr}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onCostChange={setCostStr}
        autoFocusName
      />
    </StickyFooterScreen>
  );
}
