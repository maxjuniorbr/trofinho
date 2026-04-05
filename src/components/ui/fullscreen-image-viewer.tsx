import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';

type FullscreenImageViewerProps = Readonly<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}>;

export function FullscreenImageViewer({ visible, imageUrl, onClose }: FullscreenImageViewerProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={[styles.closeBtn, { top: insets.top + spacing['3'] }]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fechar imagem"
        >
          <X size={24} color="#FFFFFF" strokeWidth={2} />
        </Pressable>
        <Image
          source={imageUrl}
          style={styles.image}
          contentFit="contain"
          transition={200}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    position: 'absolute',
    right: spacing['4'],
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
