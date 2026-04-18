import { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Settings, X } from 'lucide-react-native';
import { HeaderIconButton } from '@/components/ui/screen-header';
import { Button } from '@/components/ui/button';
import { InlineMessage } from '@/components/ui/inline-message';
import { SteppedSlider } from '@/components/ui/stepped-slider';
import { useTransientMessage } from '@/hooks/use-transient-message';
import { useTheme } from '@/context/theme-context';
import type { ThemeColors } from '@/constants/theme';
import { radii, spacing, typography } from '@/constants/theme';
import { hapticSuccess } from '@lib/haptics';

type PiggyConfigSheetProps = Readonly<{
  visible: boolean;
  onClose: () => void;
  appreciationRate: number;
  withdrawalRate: number;
  onSaveAppreciation: (rate: number) => Promise<void>;
  onSaveWithdrawal: (rate: number) => Promise<void>;
  savingAppreciation: boolean;
  savingWithdrawal: boolean;
}>;

export function PiggyConfigSheet({
  visible,
  onClose,
  appreciationRate,
  withdrawalRate,
  onSaveAppreciation,
  onSaveWithdrawal,
  savingAppreciation,
  savingWithdrawal,
}: PiggyConfigSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [draftAppreciation, setDraftAppreciation] = useState<number | null>(null);
  const [draftWithdrawal, setDraftWithdrawal] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const visibleSuccess = useTransientMessage(successMessage);

  const currentAppreciation = draftAppreciation ?? appreciationRate;
  const currentWithdrawal = draftWithdrawal ?? withdrawalRate;

  const handleAppreciationComplete = useCallback(
    async (rate: number) => {
      try {
        await onSaveAppreciation(rate);
        hapticSuccess();
        setSuccessMessage(`Valorização configurada para ${rate}% ao mês.`);
      } catch {
        setSuccessMessage('Erro ao salvar valorização.');
      } finally {
        setDraftAppreciation(null);
      }
    },
    [onSaveAppreciation],
  );

  const handleWithdrawalComplete = useCallback(
    async (rate: number) => {
      try {
        await onSaveWithdrawal(rate);
        hapticSuccess();
        setSuccessMessage(`Taxa de resgate configurada para ${rate}%.`);
      } catch {
        setSuccessMessage('Erro ao salvar taxa de resgate.');
      } finally {
        setDraftWithdrawal(null);
      }
    },
    [onSaveWithdrawal],
  );

  const handleClose = useCallback(() => {
    setDraftAppreciation(null);
    setDraftWithdrawal(null);
    setSuccessMessage(null);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={[styles.overlay, { backgroundColor: colors.overlay.scrim }]}
        behavior="padding"
      >
        <View style={[styles.sheet, { backgroundColor: colors.bg.surface }]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[styles.headerIcon, { backgroundColor: colors.accent.adminBg }]}
              >
                <Settings size={20} color={colors.accent.adminDim} strokeWidth={2} />
              </View>
              <View style={styles.headerText}>
                <Text style={[styles.title, { color: colors.text.primary }]}>
                  Configurar Cofrinho
                </Text>
                <Text style={[styles.subtitle, { color: colors.text.muted }]}>
                  Regras só visíveis para você
                </Text>
              </View>
            </View>
            <HeaderIconButton
              icon={X}
              onPress={handleClose}
              accessibilityLabel="Fechar configuração do cofrinho"
            />
          </View>

          <ScrollView
            overScrollMode="never"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            {visibleSuccess ? (
              <View style={styles.feedbackRow}>
                <InlineMessage message={visibleSuccess} variant="success" />
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                TAXA DE RENDIMENTO (% AO MÊS)
              </Text>
              <Text style={[styles.sectionHelp, { color: colors.text.muted }]}>
                Quanto o cofrinho rende a cada mês
              </Text>
              <SteppedSlider
                value={currentAppreciation}
                onValueChange={setDraftAppreciation}
                onSlidingComplete={handleAppreciationComplete}
                disabled={savingAppreciation}
                accessibilityLabel="Índice de valorização do cofrinho"
              />
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.text.muted }]}>
                TAXA DE SAQUE ANTECIPADO (%)
              </Text>
              <Text style={[styles.sectionHelp, { color: colors.text.muted }]}>
                Cobrada quando o filho saca do cofrinho
              </Text>
              <SteppedSlider
                value={currentWithdrawal}
                onValueChange={setDraftWithdrawal}
                onSlidingComplete={handleWithdrawalComplete}
                disabled={savingWithdrawal}
                accessibilityLabel="Taxa de resgate do cofrinho"
              />
            </View>

            <Button
              variant="primary"
              label="Fechar"
              onPress={handleClose}
              accessibilityLabel="Fechar configuração do cofrinho"
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'flex-end' },
    sheet: {
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      padding: spacing['6'],
      paddingBottom: spacing['12'],
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing['5'],
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
      flex: 1,
    },
    headerIcon: {
      width: 40,
      height: 40,
      borderRadius: radii.full,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: spacing['0.5'],
    },
    title: {
      fontSize: typography.size.md,
      fontFamily: typography.family.extrabold,
    },
    subtitle: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
    },
    content: {
      gap: spacing['4'],
    },
    feedbackRow: {
      marginBottom: spacing['1'],
    },
    section: {
      backgroundColor: colors.bg.muted,
      borderRadius: radii.xl,
      borderCurve: 'continuous',
      padding: spacing['4'],
      gap: spacing['2'],
    },
    sectionLabel: {
      fontSize: typography.size.xxs,
      fontFamily: typography.family.bold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    sectionHelp: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.medium,
      marginBottom: spacing['1'],
    },
  });
}
