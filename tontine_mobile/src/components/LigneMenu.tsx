import { StyleSheet, Text, View } from "react-native";
import { Carte } from "./Carte";
import { Icone, type NomIcone } from "./Icone";
import { theme } from "@/theme";

/**
 * Rangée de menu avec icône à gauche, libellé au centre (flex : 1, retour
 * à la ligne autorisé) et chevron à droite. Chaque rangée est sa propre
 * carte (rayon 24, ombre douce du thème). Hauteur minimale 64.
 */
interface Props {
  icone: NomIcone;
  libelle: string;
  onPress: () => void;
  couleurIcone?: string;
}

export function LigneMenu({ icone, libelle, onPress, couleurIcone }: Props) {
  return (
    <Carte onPress={onPress} style={styles.carte}>
      <View style={styles.rangee}>
        <Icone
          nom={icone}
          taille={22}
          couleur={couleurIcone ?? theme.couleurs.primaire}
          style={styles.iconeGauche}
        />
        <Text style={[theme.typographie.corpsMedium, styles.libelle]}>
          {libelle}
        </Text>
        <Icone
          nom="chevron-forward"
          taille={18}
          couleur={theme.couleurs.grisPerdu}
          style={styles.iconeDroite}
        />
      </View>
    </Carte>
  );
}

const styles = StyleSheet.create({
  carte: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    // Carte hérite borderRadius 24 et ombres du composant Carte
  },
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 18,
    minHeight: 64,
  },
  iconeGauche: {
    flexShrink: 0,
  },
  libelle: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    color: theme.couleurs.textePrimaire,
  },
  iconeDroite: {
    flexShrink: 0,
  },
});
