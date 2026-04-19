import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { InlineMessage } from '@/components/ui/inline-message';
import { useUpdateUserAvatar } from '@/hooks/queries';
import { useTheme } from '@/context/theme-context';
import { gradients, heroPalette, radii, spacing, typography } from '@/constants/theme';

type AvatarSectionProps = Readonly<{
  name: string;
  email?: string;
  avatarUri: string | null;
  role?: 'admin' | 'filho';
  onAvatarChange: (url: string | null) => void;
}>;

export const AvatarSection = ({
  name,
  email,
  avatarUri,
  role = 'admin',
  onAvatarChange,
}: AvatarSectionProps) => {
  const { colors } = useTheme();
  const accentColor = role === 'filho' ? colors.accent.filhoDim : colors.accent.adminDim;
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
    <LinearGradient
      colors={gradients.heroNavy.colors}
      locations={gradients.heroNavy.locations}
      start={gradients.heroNavy.start}
      end={gradients.heroNavy.end}
      style={styles.card}
    >
      <View style={styles.userRow}>
        <Pressable
          onPress={handlePick}
          disabled={updateAvatarMutation.isPending}
          style={styles.avatarButton}
          accessibilityRole="button"
          accessibilityLabel="Alterar foto de perfil"
        >
          <Avatar
            name={name}
            size={56}
            solidColor="rgba(255, 255, 255, 0.15)"
            imageUri={avatarUri}
          />
          <View style={[styles.cameraBtn, { backgroundColor: accentColor }]}>
            {updateAvatarMutation.isPending ? (
              <ActivityIndicator size="small" color={heroPalette.textOnNavy} />
            ) : (
              <Camera size={12} color={heroPalette.textOnNavy} strokeWidth={2.5} />
            )}
          </View>
        </Pressable>

        <View style={styles.userInfo}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {email ? (
            <View style={styles.emailRow}>
              <Mail size={12} color={heroPalette.textOnNavyMuted} strokeWidth={2} />
              <Text style={styles.email} numberOfLines={1}>
                {email}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <InlineMessage message={error} variant="error" />
        </View>
      ) : null}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.xl,
    borderCurve: 'continuous',
    padding: spacing['5'],
    overflow: 'hidden',
    gap: spacing['3'],
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['3'],
  },
  avatarButton: { position: 'relative', flexShrink: 0 },
  cameraBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: typography.family.extrabold,
    fontSize: typography.size.md,
    color: heroPalette.textOnNavy,
  },
  emailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing['1'],
    marginTop: spacing['0.5'],
  },
  email: {
    flex: 1,
    fontFamily: typography.family.medium,
    fontSize: typography.size.xs,
    color: heroPalette.textOnNavyMuted,
  },
  errorWrap: { width: '100%' },
});
