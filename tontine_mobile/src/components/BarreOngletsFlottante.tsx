import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { hapticSelection } from "@/utils/haptics";
import { Icone, type NomIcone } from "./Icone";

// Props effectivement utilisées de BottomTabBarProps (expo-router). Le reste
// (descriptors, emitter) est ignoré : l'écart de largeur est compatible via spread.
interface BarreOngletsProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (routeKey: string) => void;
  insets: { bottom: number };
}

const ONGLETS: Record<string, { icone: NomIcone; iconeActive: NomIcone; libelle: string }> = {
  index: { icone: "home-outline", iconeActive: "home", libelle: "Accueil" },
  cotiser: { icone: "add-circle-outline", iconeActive: "add-circle", libelle: "Cotiser" },
  projets: { icone: "wallet-outline", iconeActive: "wallet", libelle: "Projets" },
  retirer: { icone: "arrow-up-circle-outline", iconeActive: "arrow-up-circle", libelle: "Retirer" },
  rapport: { icone: "bar-chart-outline", iconeActive: "bar-chart", libelle: "Rapport" },
};

export function BarreOngletsFlottante({ state, navigateToTab, insets }: BarreOngletsProps) {
  return (
    <View style={[styles.conteneur, { paddingBottom: 8 + Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <View style={styles.barre}>
        {state.routes.map((route, index) => {
          const estActif = index === state.index;
          const conf = ONGLETS[route.name] ?? {
            icone: "ellipse-outline" as NomIcone,
            iconeActive: "ellipse" as NomIcone,
            libelle: route.name,
          };
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                if (estActif) return;
                hapticSelection();
                navigateToTab(route.key);
              }}
              style={styles.onglet}
              accessibilityRole="button"
              accessibilityState={{ selected: estActif }}
            >
              <Icone
                nom={estActif ? conf.iconeActive : conf.icone}
                taille={22}
                couleur={estActif ? theme.couleurs.primaire : theme.couleurs.texteSecondaire}
              />
              <Text
                style={[
                  theme.typographie.legende2,
                  { color: estActif ? theme.couleurs.primaire : theme.couleurs.texteSecondaire },
                ]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.1}
              >
                {conf.libelle}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  barre: {
    flexDirection: "row",
    backgroundColor: theme.couleurs.surface,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 8,
    ...theme.ombres.onglets,
  },
  onglet: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: 6,
    minHeight: 48,
    borderRadius: 999,
  },
});
