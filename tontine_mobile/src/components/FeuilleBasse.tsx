import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { theme } from "@/theme";

interface Props {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}

/** Feuille basse (bottom sheet) simple : modal transparent + carte en bas. */
export function FeuilleBasse({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.racine}>
        <Pressable style={styles.overlayHit} onPress={onClose}>
          <Animated.View entering={FadeIn.duration(160)} style={styles.overlay} />
        </Pressable>
        <Animated.View entering={SlideInDown.springify().damping(22).stiffness(220)} style={styles.feuille}>
          <View style={styles.poignee} />
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  racine: {
    flex: 1,
    justifyContent: "flex-end",
  },
  overlayHit: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(8, 28, 22, 0.42)",
  },
  feuille: {
    backgroundColor: theme.couleurs.surface,
    borderTopLeftRadius: theme.rayons.feuille,
    borderTopRightRadius: theme.rayons.feuille,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 32,
    ...theme.ombres.feuille,
  },
  poignee: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: theme.couleurs.bordure,
    alignSelf: "center",
    marginBottom: 16,
  },
});
