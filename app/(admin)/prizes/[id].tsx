import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus } from 'lucide-react-native';
import { setNavigationFeedback } from '@lib/navigation-feedback';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FormFooter } from '@/components/ui/form-footer';
import { InlineMessage } from '@/components/ui/inline-message';
import { ScreenHeader } from '@/components/ui/screen-header';
import { StickyFooterScreen } from '@/components/ui/sticky-footer-screen';
import { PrizeFormFields } from '@/components/prizes/prize-form-fields';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { usePrizeDetail, useUpdatePrize, useDeactivatePrize, useReactivatePrize } from '@/hooks/queries';

export default function AdminPrizeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const { data: prize, isLoading, error, refetch } = usePrizeDetail(id);
  const updatePrizeMutation = useUpdatePrize();
  const deactivateMutation = useDeactivatePrize();
  const reactivateMutation = useReactivatePrize();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [costStr, setCostStr] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error'>('loaded');
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [pickingImage, setPickingImage] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(false);
  const [pendingWarning, setPendingWarning] = useState<string | null>(null);

  useEffect(() => {
    if (prize && !formInitialized) {
      setName(prize.nome);
      setDescription(prize.descricao ?? '');
      setCostStr(String(prize.custo_pontos));
      setImagePreview(prize.imagem_url ?? null);
      setImageState(prize.imagem_url ? 'loading' : 'loaded');
      setSelectedImageUri(null);
      setIsActive(prize.ativo);
      setFormInitialized(true);
    }
  }, [prize, formInitialized]);

  const handlePickImage = async () => {
    setPickingImage(true);
    setFormError(null);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [16, 10],
        quality: 0.8,
      });

      if (result.canceled || !result.assets[0]) {
        return;
      }

      setSelectedImageUri(result.assets[0].uri);
      setImagePreview(result.assets[0].uri);
      setImageState('loading');
    } catch (e) {
      console.error(e);
      setFormError('Não foi possível selecionar a imagem agora.');
    } finally {
      setPickingImage(false);
    }
  };

  const handleSave = () => {
    if (!id || !prize) return;

    setFormError(null);

    if (!name.trim()) {
      setFormError('Informe o nome do prêmio.');
      return;
    }

    const cost = Number.parseInt(costStr, 10);

    if (Number.isNaN(cost) || cost <= 0) {
      setFormError('Custo em pontos deve ser um número maior que zero.');
      return;
    }

    updatePrizeMutation.mutate(
      {
        id,
        input: {
          nome: name.trim(),
          descricao: description.trim() || null,
          custo_pontos: cost,
          ativo: isActive,
          imagem_url: prize.imagem_url ?? null,
          imageUri: selectedImageUri,
        },
      },
      {
        onSuccess: (result) => {
          setSelectedImageUri(null);
          setImagePreview(result.imageUrl ?? prize.imagem_url ?? null);
          setImageState((result.imageUrl ?? prize.imagem_url) ? 'loading' : 'loaded');
          setFormError(result.pointsMessage);

          if (result.pointsMessage) {
            refetch();
            return;
          }

          setNavigationFeedback('admin-prize-list', 'Prêmio atualizado com sucesso.');
          router.dismissTo('/(admin)/prizes');
        },
        onError: (err) => {
          setFormError(err.message);
        },
      },
    );
  };

  if (isLoading) {
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
        <EmptyState error={error?.message ?? 'Prêmio não encontrado.'} onRetry={() => refetch()} />
      </View>
    );
  }

  let mediaPreviewContent = (
    <View style={[styles.mediaPreview, styles.mediaPlaceholder]}>
      <ImagePlus size={28} color={colors.text.muted} strokeWidth={2} />
      <Text style={styles.mediaPlaceholderText}>Sem capa</Text>
    </View>
  );

  if (imagePreview) {
    if (imageState === 'error') {
      mediaPreviewContent = (
        <View style={[styles.mediaWrapper, styles.mediaFallback, { backgroundColor: colors.bg.muted }]}>
          <Text style={[styles.mediaFallbackText, { color: colors.text.muted }]}>
            Não foi possível carregar a imagem
          </Text>
        </View>
      );
    } else {
      mediaPreviewContent = (
        <View style={styles.mediaWrapper}>
          <Image
            source={imagePreview}
            style={styles.mediaPreview}
            contentFit="cover"
            transition={200}
            accessibilityLabel={`Imagem do prêmio ${name || prize.nome}`}
            onLoadStart={() => setImageState('loading')}
            onLoad={() => setImageState('loaded')}
            onError={() => setImageState('error')}
          />
          {imageState === 'loaded' ? null : (
            <View style={[styles.mediaLoading, { backgroundColor: colors.bg.muted }]}>
              <ActivityIndicator size="small" color={colors.accent.admin} />
            </View>
          )}
        </View>
      );
    }
  }

  return (
    <StickyFooterScreen
      title="Editar Prêmio"
      onBack={() => router.back()}
      keyboardAvoiding
      contentPadding={spacing['6']}
      contentGap={spacing['5']}
      footer={(
        <FormFooter message={formError} compact includeSafeBottom={false}>
          <Button
            label="Salvar alterações"
            onPress={handleSave}
            loading={updatePrizeMutation.isPending}
            accessibilityLabel="Salvar alterações do prêmio"
          />
        </FormFooter>
      )}
    >
      <StatusBar style={colors.statusBar} />
      {isActive ? null : (
        <InlineMessage
          message="Este prêmio está inativo e não aparece para os filhos."
          variant="warning"
        />
      )}

      {pendingWarning ? (
        <InlineMessage
          message={pendingWarning}
          variant="warning"
        />
      ) : null}

      <View style={styles.mediaCard}>
        {mediaPreviewContent}

        <Button
          label={pickingImage ? 'Abrindo galeria…' : 'Escolher capa'}
          variant="secondary"
          onPress={handlePickImage}
          disabled={pickingImage}
          accessibilityLabel="Escolher imagem do prêmio"
        />
      </View>

      <View style={styles.statusCard}>
        <View style={styles.statusText}>
          <Text style={styles.statusTitle}>Disponibilidade</Text>
          <Text style={styles.statusDescription}>
            Filhos veem e podem resgatar apenas prêmios ativos.
          </Text>
        </View>
        <Switch
          value={isActive}
          onValueChange={(newValue) => {
            if (newValue) {
              reactivateMutation.mutate(id, {
                onSuccess: () => {
                  setIsActive(true);
                  setPendingWarning(null);
                },
                onError: (err) => {
                  setFormError(err.message);
                },
              });
              return;
            }
            Alert.alert(
              'Desativar prêmio?',
              'O prêmio não aparecerá para os filhos enquanto estiver inativo.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Desativar',
                  style: 'destructive',
                  onPress: () => {
                    deactivateMutation.mutate(id, {
                      onSuccess: (result) => {
                        setIsActive(false);
                        setPendingWarning(result.warning ?? null);
                      },
                      onError: (err) => {
                        setFormError(err.message);
                      },
                    });
                  },
                },
              ],
            );
          }}
          disabled={deactivateMutation.isPending || reactivateMutation.isPending}
          trackColor={{ false: colors.border.default, true: colors.accent.admin }}
          thumbColor={colors.text.inverse}
          accessibilityLabel="Alternar disponibilidade do prêmio"
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
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing['6'] },
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
    mediaLoading: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mediaFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing['4'],
    },
    mediaFallbackText: {
      fontSize: typography.size.sm,
      fontFamily: typography.family.medium,
      textAlign: 'center',
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
    statusCard: {
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      borderWidth: 1,
      borderColor: colors.border.default,
      backgroundColor: colors.bg.surface,
      padding: spacing['4'],
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing['3'],
    },
    statusText: {
      flex: 1,
      gap: spacing['1'],
    },
    statusTitle: {
      fontSize: typography.size.md,
      fontFamily: typography.family.semibold,
      color: colors.text.primary,
    },
    statusDescription: {
      fontSize: typography.size.sm,
      color: colors.text.secondary,
      lineHeight: typography.lineHeight.md,
    },
  });
}
