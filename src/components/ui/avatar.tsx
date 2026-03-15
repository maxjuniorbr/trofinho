import React, { useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients, typography } from '@/constants/theme';
import { useTheme } from '@/context/theme-context';

interface AvatarProps {
  name: string;
  size?: number;
  solidColor?: string;
  imageUri?: string | null;
}

type ReadonlyAvatarProps = Readonly<AvatarProps>;

export function Avatar({ name, size = 44, solidColor, imageUri }: ReadonlyAvatarProps) {
  const { colors } = useTheme();
  const borderRadius = size / 2;
  const [imgError, setImgError] = useState(false);

  if (imageUri && !imgError) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={[styles.base, styles.image, { width: size, height: size, borderRadius }]}
        accessibilityLabel={name}
        onError={() => setImgError(true)}
      />
    );
  }

  const initials = name
    .trim()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase())
    .filter(Boolean)
    .slice(0, 2)
    .join('') || '?';

  const fontSize = Math.round(size * 0.4);

  if (solidColor) {
    return (
      <LinearGradient
        colors={[solidColor, solidColor]}
        style={[styles.base, { width: size, height: size, borderRadius }]}
      >
        <Text style={[styles.initial, { color: colors.text.inverse, fontSize }]}>{initials}</Text>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={gradients.gold.colors}
      start={gradients.gold.start}
      end={gradients.gold.end}
      style={[styles.base, { width: size, height: size, borderRadius }]}
    >
      <Text style={[styles.initial, { color: colors.text.onBrand, fontSize }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  initial: {
    fontFamily: typography.family.black,
    fontWeight: typography.weight.black,
  },
});
