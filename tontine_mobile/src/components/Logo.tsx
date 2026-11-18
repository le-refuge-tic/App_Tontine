import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { NOM_APP } from "@/constants/app";

// TODO(logo) : remplacer le mot-texte par un vrai logo graphique.
export function Logo() {
  return (
    <View style={styles.conteneur}>
      <View style={styles.pastille}>
        <IconeCadena />
      </View>
      <Text style={[theme.typographie.titre, styles.nom]}>{NOM_APP}</Text>
    </View>
  );
}

function IconeCadena() {
  // Pastille émeraude simple avec une pièce dorée (placeholder avant un vrai logo).
  return (
    <View style={styles.piece}>
      <Text style={styles.pieceTexte}>R</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: "center",
    gap: 14,
  },
  pastille: {
    width: 76,
    height: 76,
    borderRadius: 24,
    backgroundColor: theme.couleurs.primaireFonce,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.couleurs.or,
    alignItems: "center",
    justifyContent: "center",
  },
  pieceTexte: {
    ...theme.typographie.montantMoyen,
    color: theme.couleurs.primaireFonce,
  },
  nom: {
    color: theme.couleurs.primaireFonce,
  },
});
