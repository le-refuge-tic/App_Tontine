import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ecran } from "@/components/Ecran";
import { Logo } from "@/components/Logo";
import { Bouton } from "@/components/Bouton";
import { theme } from "@/theme";
import { hapticSelection } from "@/utils/haptics";

export default function Bienvenue() {
  return (
    <Ecran>
      <View style={styles.contenu}>
        <View style={styles.haut}>
          <Logo />
        </View>
        <View style={styles.bas}>
          <Text style={[theme.typographie.titre, styles.accroche]}>
            Cotisez un peu chaque jour.{"\n"}Retrouvez tout à la fin.
          </Text>
          <Text style={[theme.typographie.corps2, styles.sousAccroche, { color: theme.couleurs.texteSecondaire }]}>
            Une cotisation simple, un solde toujours visible, des retraits sécurisés.
          </Text>
          <View style={styles.boutons}>
            <Bouton libelle="Créer mon compte" onPress={() => { hapticSelection(); router.push("/inscription"); }} />
            <Bouton libelle="Me connecter" variante="secondaire" iconeDroite="arrow-forward-outline" onPress={() => { hapticSelection(); router.push("/connexion"); }} style={styles.boutonSecondaire} />
          </View>
        </View>
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: {
    flex: 1,
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 40,
    paddingBottom: 32,
    justifyContent: "space-between",
  },
  haut: {
    alignItems: "center",
    marginTop: 40,
  },
  bas: {
    gap: 12,
  },
  accroche: {
    color: theme.couleurs.textePrimaire,
  },
  sousAccroche: {
    marginBottom: 8,
  },
  boutons: {
    gap: 12,
  },
  boutonSecondaire: {},
});
