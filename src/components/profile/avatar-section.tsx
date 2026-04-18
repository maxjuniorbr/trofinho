import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera, User, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { InlineMessage } from '@/components/ui/inline-message';
import { useUpdateUserAvatar } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { radii, spacing, typography } from '@/constants/theme';

type AvatarSectionProps = Readonly<{
  name: string;
  avatarUri: string | null;
  role?: 'admin' | 'filho';
  onAvatarChange: (url: string | null) => void;
}>;

export const AvatarSection = ({
  name,
  avatarUri,
  role = 'admin',
  onAvatarChange,
}: AvatarSectionProps) => {
  const { colors } = useTheme();
  const bg = colors.bg.surface;
  const border = colors.border.subtle;
  const textColor = colors.text.primary;
  const textMuted = colors.text.secondary;
  const accentColor = role === 'filho' ? colors.accent.filhoDim : colors.accent.adminDim;
  const RoleIcon = role === 'filho' ? User : ShieldCheck;
  const roleLabel = role === 'filho' ? 'Filho' : 'Administrador';
  const [error, setError] = useState<string | null>(null);
  const updateAvatarMutation = useUpdateUserAvatar();

  const handlePick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setError(null);
    try {
      const url = await updateAvatarMutation.mutateAsync(result.assets[0].uri);
      onAvatarChange(url ?? null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível atualizar a foto.';
      setError(message);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: bg, borderColor: border }]}>
      <View style={styles.roleRow}>
        <RoleIcon size={14} color={textMuted} strokeWidth={2} />
        <Text style={[styles.roleLabel, { color: textMuted }]}>{roleLabel.toUpperCase()}</Text>
      </View>

      <View style={styles.avatarArea}>
        <Pressable
          onPress={handlePick}
          disabled={updateAvatarMutation.isPending}
          style={styles.wrapper}
          accessibilityRole="button"
          accessibilityLabel="Alterar foto de perfil"
        >
          <Avatar name={name} size={80} imageUri={avatarUri} />
          <View style={[styles.cameraBtn, { backgroundColor: accentColor }]}>
            {updateAvatarMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Camera size={12} color="#FFFFFF" strokeWidth={2.5} />
            )}
          </View>
        </Pressable>
      </View>

      <Text style={[styles.name, { color: textColor }]}>{name}</Text>
      {error ? <InlineMessage message={error} variant="error" /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    borderWidth: 1,
    padding: spacing['5'],
    alignItems: 'center',
    gap: spacing['2'],
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1.5'],
    marginBottom: spacing['1'],
  },
  roleLabel: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.xs,
    letterSpacing: 0.5,
  },
  avatarArea: { position: 'relative' },
  wrapper: { position: 'relative' },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontFamily: typography.family.bold, fontSize: typography.size.xl, textAlign: 'center' },
});
