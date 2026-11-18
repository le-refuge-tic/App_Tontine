import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
  /** Au toucher, la carte devient un bouton (zone tactile >= 48px gérée par le contenu). */
  onPress?: () => void;
  /** Ombre plus marquée (carte héro ou élément important). */
  elevee?: boolean;
  /** Pas de padding interne (l'appelant gère). */
  sansPadding?: boolean;
  style?: ViewStyle;
}

export function Carte({ children, onPress, elevee = false, sansPadding = false, style }: Props) {
  const vue = (
    <View style={[styles.carte, elevee && theme.ombres.carteElevee, !elevee && theme.ombres.carte, sansPadding && styles.sansPadding, style]}>
      {children}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {vue}
      </Pressable>
    );
  }
  return vue;
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: theme.couleurs.surface,
    borderRadius: theme.rayons.carte,
    padding: 20,
  },
  sansPadding: {
    padding: 0,
  },
});
