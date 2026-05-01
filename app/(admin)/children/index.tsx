import { Alert, StyleSheet, Text, View, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import { getRandomBytes } from 'expo-crypto';
import { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Eye, Plus, Star, Ticket } from 'lucide-react-native';
import { HeaderIconButton, ScreenHeader } from '@/components/ui/screen-header';
import { EmptyState } from '@/components/ui/empty-state';
import { ListScreenSkeleton } from '@/components/ui/skeleton';
import { SafeScreenFrame } from '@/components/ui/safe-screen-frame';
import { Avatar } from '@/components/ui/avatar';
import { ChildViewSheet } from '@/components/children/child-view-sheet';
import { ChildAddSheet } from '@/components/children/child-add-sheet';
import { ChildInviteSheet, type ChildInvite } from '@/components/children/child-invite-sheet';
import {
  useChildrenList,
  useAdminBalances,
  useProfile,
  combineQueryStates,
} from '@/hooks/queries';
import type { BalanceWithChild } from '@lib/balances';
import type { Child } from '@lib/children';
import { supabase } from '@lib/supabase';
import { useTheme } from '@/context/theme-context';
import { opacityDisabled, radii, shadows, spacing, typography } from '@/constants/theme';

// ── Helpers ──────────────────────────────────────────────

const INVITE_CODE_LENGTH = 6;
const INVITE_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid confusion

function generateInviteCode(): string {
  let code = '';
  const alphabetLength = INVITE_CODE_CHARS.length;
  const maxUnbiasedByte = Math.floor(256 / alphabetLength) * alphabetLength - 1;

  while (code.length < INVITE_CODE_LENGTH) {
    const bytes = getRandomBytes(INVITE_CODE_LENGTH * 2);
    for (const byte of bytes) {
      if (byte > maxUnbiasedByte) continue;
      code += INVITE_CODE_CHARS[byte % alphabetLength];
      if (code.length === INVITE_CODE_LENGTH) break;
    }
  }

  return code;
}

// ── Screen ───────────────────────────────────────────────

export default function AdminChildrenScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [viewChildId, setViewChildId] = useState<string | null>(null);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);
  const [currentInvite, setCurrentInvite] = useState<ChildInvite | null>(null);
  const [generatingInviteFor, setGeneratingInviteFor] = useState<string | null>(null);

  const { data: profile } = useProfile();
  const childrenQuery = useChildrenList();
  const balancesQuery = useAdminBalances();
  const { isLoading, isFetching, error, refetchAll } = combineQueryStates(
    childrenQuery,
    balancesQuery,
  );

  const children = childrenQuery.data ?? [];
  const balancesMap = useMemo(() => {
    const balances = balancesQuery.data ?? [];
    return new Map<string, BalanceWithChild>(balances.map((s) => [s.filho_id, s]));
  }, [balancesQuery.data]);

  const handleRefresh = useCallback(async () => {
    await refetchAll();
  }, [refetchAll]);

  const handleGenerateInvite = useCallback(
    async (child: Child) => {
      if (!profile) {
        Alert.alert('Erro', 'Perfil não carregado. Tente novamente.');
        return;
      }

      setGeneratingInviteFor(child.id);

      try {
        for (let attempt = 0; attempt < 5; attempt++) {
          const codigo = generateInviteCode();

          // The `convites_filho` table may not be in the generated DB types yet,
          // so we cast through `any` to insert via the Supabase client.
          const { data, error: insertError } = await (supabase as any)
            .from('convites_filho')
            .insert({
              familia_id: profile.familia_id,
              filho_id: child.id,
              codigo,
              criado_por: profile.id,
              nome_filho: child.nome,
            })
            .select('codigo, expira_em')
            .single();

          if (!insertError) {
            setCurrentInvite({
              codigo: data.codigo,
              nome_filho: child.nome,
              expira_em: data.expira_em,
            });
            setInviteSheetVisible(true);
            return;
          }

          if (!(insertError.message?.includes('unique') || insertError.code === '23505')) {
            break;
          }
        }

        Alert.alert('Erro', 'Não foi possível gerar o convite. Tente novamente.');
      } finally {
        setGeneratingInviteFor(null);
      }
    },
    [profile],
  );

  const renderContent = () => {
    if (isLoading) {
      return <ListScreenSkeleton />;
    }
    if (error || children.length === 0) {
      return (
        <EmptyState
          error={error?.message}
          empty={children.length === 0}
          emptyMessage={'Nenhum filho cadastrado.\nToque em "+" para cadastrar.'}
          onRetry={handleRefresh}
        />
      );
    }
    return (
      <FlashList
        data={children}
        keyExtractor={(item) => item.id}
        maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={styles.lista}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.brand.vivid}
          />
        }
        ListHeaderComponent={<View style={{ height: spacing['4'] }} />}
        ListFooterComponent={<View style={{ height: spacing['12'] }} />}
        renderItem={({ item }) => {
          const balance = balancesMap.get(item.id);
          const totalPts = balance ? balance.saldo_livre + balance.cofrinho : 0;
          const isGenerating = generatingInviteFor === item.id;
          return (
            <View
              style={[
                styles.card,
                shadows.card,
                { opacity: item.ativo === false ? opacityDisabled.heavy : 1 },
              ]}
            >
              <View style={styles.cardRow}>
                <Avatar name={item.nome} size={56} imageUri={item.avatar_url} />

                <View style={styles.cardInfo}>
                  <Text style={styles.cardNome}>{item.nome}</Text>

                  {item.ativo === false && <Text style={styles.inactiveBadge}>Desativado</Text>}

                  <Text
                    style={[
                      styles.cardStatus,
                      {
                        color: item.usuario_id
                          ? colors.semantic.success
                          : colors.semantic.warning,
                      },
                    ]}
                  >
                    {item.usuario_id ? 'Conta vinculada' : 'Sem conta'}
                  </Text>

                  {balance ? (
                    <View style={styles.ptsRow}>
                      <Star size={12} color={colors.brand.vivid} fill={colors.brand.vivid} />
                      <Text style={styles.ptsTotal}>{totalPts} pts</Text>
                      <Text style={styles.ptsBreakdown}>
                        ({balance.saldo_livre} livre · {balance.cofrinho} cofrinho)
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.actionButtons}>
                  {!item.usuario_id && item.ativo !== false && (
                    <HeaderIconButton
                      icon={Ticket}
                      onPress={() => {
                        if (!isGenerating) handleGenerateInvite(item);
                      }}
                      accessibilityLabel={`Gerar convite para ${item.nome}`}
                    />
                  )}
                  <HeaderIconButton
                    icon={Eye}
                    onPress={() => setViewChildId(item.id)}
                    accessibilityLabel={`Ver detalhes de ${item.nome}`}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
    );
  };

  return (
    <SafeScreenFrame bottomInset>
      <StatusBar style={colors.statusBar} />
      <ScreenHeader
        title="Filhos"
        subtitle={
          children.length === 0
            ? 'Nenhum cadastrado'
            : children.length === 1
              ? '1 cadastrado'
              : `${children.length} cadastrados`
        }
        onBack={() => router.back()}
        rightAction={
          <HeaderIconButton
            icon={Plus}
            onPress={() => setAddSheetVisible(true)}
            accessibilityLabel="Cadastrar filho"
          />
        }
      />

      {renderContent()}

      <ChildAddSheet
        visible={addSheetVisible}
        familiaId={profile?.familia_id}
        onClose={() => setAddSheetVisible(false)}
        onChildAdded={(child) => {
          setAddSheetVisible(false);
          refetchAll().then(() => handleGenerateInvite(child));
        }}
      />
      <ChildViewSheet childId={viewChildId} onClose={() => setViewChildId(null)} />
      <ChildInviteSheet
        visible={inviteSheetVisible}
        onClose={() => {
          setInviteSheetVisible(false);
          setCurrentInvite(null);
        }}
        invite={currentInvite}
      />
    </SafeScreenFrame>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    lista: { paddingHorizontal: spacing['4'] },
    card: {
      borderRadius: radii.xl,
      borderWidth: 1,
      padding: spacing['4'],
      marginBottom: spacing['3'],
      backgroundColor: colors.bg.surface,
      borderColor: colors.border.subtle,
    },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['3'],
    },
    cardInfo: { flex: 1 },
    cardNome: {
      fontSize: typography.size.md,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    inactiveBadge: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.semibold,
      color: colors.semantic.warningText,
      marginTop: spacing['0.5'],
    },
    cardStatus: { fontSize: typography.size.xs, marginTop: spacing['0.5'] },
    ptsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
      marginTop: spacing['1'],
    },
    ptsTotal: {
      fontSize: typography.size.xs,
      fontFamily: typography.family.bold,
      color: colors.text.primary,
    },
    ptsBreakdown: {
      fontSize: typography.size.xxs,
      color: colors.text.secondary,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing['1'],
    },
  });
}
