import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail } from 'lucide-react-native';
import { Avatar } from '@/components/ui/avatar';
import { gradients, heroPalette, radii, spacing, typography } from '@/constants/theme';

type AvatarSectionProps = Readonly<{
  name: string;
  email?: string;
  avatarUri: string | null;
}>;

export const AvatarSection = ({ name, email, avatarUri }: AvatarSectionProps) => {
  return (
    <LinearGradient
      colors={gradients.heroNavy.colors}
      locations={gradients.heroNavy.locations}
      start={gradients.heroNavy.start}
      end={gradients.heroNavy.end}
      style={styles.card}
    >
      <View style={styles.userRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            name={name}
            size={56}
            solidColor={heroPalette.borderSoft}
            imageUri={avatarUri}
          />
        </View>

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
  avatarWrap: { flexShrink: 0 },
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
});
