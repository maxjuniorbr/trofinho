import * as Sentry from '@sentry/react-native';
import { StyleSheet, Text, View } from 'react-native';
import { localizeRpcError } from '@lib/api-error';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';
import { setNavigationFeedback } from '@lib/navigation-feedback';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { Button } from '@/components/ui/button';
import { FormFooter } from '@/components/ui/form-footer';
import { PrizeFormFields } from '@/components/prizes/prize-form-fields';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { useCreatePrize } from '@/hooks/queries';

export default function NewPrizeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const createPrizeMutation = useCreatePrize();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [pickingImage, setPickingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickImage = async () => {
    setPickingImage(true);
    setError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) return;

      setSelectedImageUri(result.assets[0].uri);
    } catch (e) {
      Sentry.captureException(e);
      setError('Não foi possível selecionar a imagem agora.');
    } finally {
      setPickingImage(false);
    }
  };

  const handleCreate = () => {
    setError(null);
    if (!name.trim()) return setError('Informe o nome do prêmio.');
    const cost = Number.parseInt(costStr, 10);
    if (Number.isNaN(cost) || cost <= 0)
      return setError('Custo em pontos deve ser um número maior que zero.');
    if (cost > 99999) return setError('O custo máximo é 99.999 pontos.');

    createPrizeMutation.mutate(
      {
        nome: name.trim(),
        descricao: description.trim() || null,
        custo_pontos: cost,
        imageUri: selectedImageUri,
      },
      {
        onSuccess: () => {
          setNavigationFeedback('admin-prize-list', 'Prêmio criado com sucesso.');
          router.dismissTo('/(admin)/prizes');
        },
        onError: (err) => {
          setError(localizeRpcError(err.message));
        },
      },
    );
  };

  const mediaPreviewContent = selectedImageUri ? (
    <View style={styles.mediaWrapper}>
      <Image
        source={selectedImageUri}
        style={styles.mediaPreview}
        contentFit="cover"
        transition={200}
        accessibilityLabel={`Imagem do prêmio ${name || 'novo'}`}
      />
    </View>
  ) : (
    <View style={[styles.mediaPreview, styles.mediaPlaceholder]}>
      <ImagePlus size={28} color={colors.text.muted} strokeWidth={2} />
      <Text style={styles.mediaPlaceholderText}>Adicionar capa (opcional)</Text>
    </View>
  );

  const getPickerLabel = () => {
    if (pickingImage) return 'Abrindo galeria…';
    if (selectedImageUri) return 'Trocar capa';
    return 'Escolher capa';
  };

  return (
    <StickyFooterScreen
      title="Novo Prêmio"
      onBack={() => router.back()}
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={
        <FormFooter message={error} compact includeSafeBottom={false}>
          <Button
            label="Criar prêmio"
            loadingLabel="Criando…"
            onPress={handleCreate}
            loading={createPrizeMutation.isPending}
            accessibilityLabel="Criar prêmio"
          />
        </FormFooter>
      }
    >
      <StatusBar style={colors.statusBar} />

      <View style={styles.mediaCard}>
        {mediaPreviewContent}

        <Button
          label={getPickerLabel()}
          variant="secondary"
          onPress={handlePickImage}
          disabled={pickingImage}
          accessibilityLabel="Escolher imagem do prêmio"
        />
      </View>

      <PrizeFormFields
        name={name}
        description={description}
        cost={costStr}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        onCostChange={setCostStr}
      />
    </StickyFooterScreen>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    mediaCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
      padding: spacing['4'],
      gap: spacing['3'],
    },
    mediaWrapper: {
      width: '100%',
      height: 180,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      overflow: 'hidden',
    },
    mediaPreview: {
      width: '100%',
      height: 180,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
    },
    mediaPlaceholder: {
      backgroundColor: colors.bg.muted,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing['2'],
    },
    mediaPlaceholderText: {
      fontSize: typography.size.sm,
      color: colors.text.muted,
      fontFamily: typography.family.medium,
    },
  });
}
