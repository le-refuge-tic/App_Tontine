import type { ReactNode } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "@/theme";

interface Props {
  children: ReactNode;
  /** Active le défilement vertical (défaut vrai). */
  defilement?: boolean;
  style?: ViewStyle;
  /** Marge interne basse (ex : pour ne pas masquer la barre d'onglets). */
  paddingBas?: number;
}

/** Conteneur d'écran : fond de l'app, safe area haut, défilement optionnel. */
export function Ecran({ children, defilement = true, style, paddingBas = 0 }: Props) {
  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <View style={[styles.conteneur, style]}>
        {defilement ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingBottom: paddingBas }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  racine: {
    flex: 1,
    backgroundColor: theme.couleurs.fond,
  },
  conteneur: {
    flex: 1,
  },
});
