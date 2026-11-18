import { StyleSheet, View } from "react-native";
import { theme } from "@/theme";

interface Props {
  /** Progression entre 0 et 1. */
  valeur: number;
  hauteur?: number;
  couleurRemplissage?: string;
  couleurFond?: string;
}

export function BarreProgression({
  valeur,
  hauteur = 6,
  couleurRemplissage = theme.couleurs.or,
  couleurFond = theme.couleurs.bordure,
}: Props) {
  const v = Math.min(1, Math.max(0, valeur));
  return (
    <View style={[styles.piste, { height: hauteur, backgroundColor: couleurFond }]}>
      <View style={[styles.remplissage, { width: `${v * 100}%`, backgroundColor: couleurRemplissage }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  piste: {
    borderRadius: 999,
    overflow: "hidden",
    width: "100%",
  },
  remplissage: {
    height: "100%",
    borderRadius: 999,
  },
});
