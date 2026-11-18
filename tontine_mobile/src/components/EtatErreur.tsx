import { StyleSheet, View, Text } from "react-native";
import { theme } from "@/theme";
import { Bouton } from "./Bouton";

interface Props {
  message: string;
  onReessayer: () => void;
}

export function EtatErreur({ message, onReessayer }: Props) {
  return (
    <View style={styles.conteneur}>
      <Text style={[theme.typographie.corps, styles.message, { color: theme.couleurs.texteSecondaire }]}>
        {message}
      </Text>
      <Bouton libelle="Réessayer" variante="secondaire" iconeGauche="refresh-outline" onPress={onReessayer} style={styles.bouton} />
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  message: {
    textAlign: "center",
    marginBottom: 16,
  },
  bouton: {
    minWidth: 180,
  },
});
