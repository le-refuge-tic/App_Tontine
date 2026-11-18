import type { ReactNode } from "react";
import { StyleSheet, View, Text } from "react-native";
import { theme } from "@/theme";
import { Icone, type NomIcone } from "./Icone";

interface Props {
  icone: NomIcone;
  titre: string;
  message: string;
  action?: ReactNode;
}

export function EtatVide({ icone, titre, message, action }: Props) {
  return (
    <View style={styles.conteneur}>
      <View style={styles.rond}>
        <Icone nom={icone} taille={28} couleur={theme.couleurs.primaire} />
      </View>
      <Text style={[theme.typographie.titre3, styles.titre]}>{titre}</Text>
      <Text style={[theme.typographie.corps2, styles.message, { color: theme.couleurs.texteSecondaire }]}>
        {message}
      </Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  rond: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: theme.couleurs.primaireTresClair,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  titre: {
    color: theme.couleurs.textePrimaire,
    marginBottom: 6,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    maxWidth: 280,
  },
});
