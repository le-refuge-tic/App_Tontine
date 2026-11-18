import { useEffect } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { theme } from "@/theme";

interface Props {
  width?: number | string;
  height?: number;
  rayon?: number;
  style?: ViewStyle;
}

/** Bloc squelette animé (pulstation douce). */
export function Squelette({ width = "100%", height = 16, rayon = 8, style }: Props) {
  const opacite = useSharedValue(0.4);
  useEffect(() => {
    opacite.value = withRepeat(withTiming(0.75, { duration: 900 }), -1, true);
  }, []);
  const anim = useAnimatedStyle(() => ({ opacity: opacite.value }));
  return (
    <Animated.View
      style={[{ width, height, backgroundColor: theme.couleurs.bordure, borderRadius: rayon }, anim, style]}
    />
  );
}

/** Carte squelette (pour les cartes de l'accueil en chargement). */
export function CarteSquelette() {
  return (
    <View style={styles.carte}>
      <Squelette width="60%" height={14} />
      <View style={{ height: 14 }} />
      <Squelette width="45%" height={30} rayon={10} />
      <View style={{ height: 18 }} />
      <Squelette width="100%" height={6} rayon={999} />
    </View>
  );
}

/** Ligne de liste squelette (pour les opérations/notifications). */
export function LigneSquelette() {
  return (
    <View style={styles.ligne}>
      <Squelette width={44} height={44} rayon={22} />
      <View style={styles.ligneTexte}>
        <Squelette width="70%" height={14} />
        <View style={{ height: 8 }} />
        <Squelette width="40%" height={12} />
      </View>
    </View>
  );
}

/** Liste de N lignes squelettes. */
export function ListeSquelette({ nombre = 5 }: { nombre?: number }) {
  return (
    <View style={styles.liste}>
      {Array.from({ length: nombre }).map((_, i) => (
        <LigneSquelette key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    backgroundColor: theme.couleurs.surface,
    borderRadius: theme.rayons.carte,
    padding: 20,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  ligneTexte: {
    flex: 1,
  },
  liste: {
    gap: 4,
  },
});
