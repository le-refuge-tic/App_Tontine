import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { theme } from "@/theme";
import { hapticLeger } from "@/utils/haptics";
import { Icone } from "./Icone";

interface Props {
  titre?: string;
  onRetour?: () => void;
}

export function BandeauRetour({ titre, onRetour }: Props) {
  return (
    <View style={styles.conteneur}>
      <Pressable
        onPress={() => {
          hapticLeger();
          if (onRetour) onRetour();
          else router.back();
        }}
        hitSlop={12}
        accessibilityLabel="Retour"
        accessibilityRole="button"
      >
        <Icone nom="arrow-back" taille={24} couleur={theme.couleurs.textePrimaire} />
      </Pressable>
      {titre ? <Text style={[theme.typographie.titre2, styles.titre]}>{titre}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  titre: {
    color: theme.couleurs.textePrimaire,
    flex: 1,
    flexShrink: 1,
  },
});
