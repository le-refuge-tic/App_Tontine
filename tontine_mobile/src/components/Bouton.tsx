import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { theme } from "@/theme";
import { hapticLeger } from "@/utils/haptics";
import { Icone, type NomIcone } from "./Icone";

export type VarianteBouton = "primaire" | "secondaire" | "danger" | "fantome";

interface Props {
  libelle: string;
  onPress: () => void;
  variante?: VarianteBouton;
  chargement?: boolean;
  desactive?: boolean;
  iconeGauche?: NomIcone;
  iconeDroite?: NomIcone;
  /** Pleine largeur (défaut : vrai sauf pour la variante fantome). */
  plein?: boolean;
  style?: ViewStyle;
}

interface Palette {
  fond: ViewStyle;
  texte: string;
  icone: string;
  avecOmbre: boolean;
}

export function Bouton({
  libelle,
  onPress,
  variante = "primaire",
  chargement = false,
  desactive = false,
  iconeGauche,
  iconeDroite,
  plein,
  style,
}: Props) {
  const echelle = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: echelle.value }] }));

  const palette = useMemo<Palette>(() => {
    const c = theme.couleurs;
    switch (variante) {
      case "secondaire":
        return { fond: { backgroundColor: c.surface }, texte: c.textePrimaire, icone: c.primaire, avecOmbre: true };
      case "danger":
        return { fond: { backgroundColor: c.danger }, texte: "#FFFFFF", icone: "#FFFFFF", avecOmbre: true };
      case "fantome":
        return { fond: { backgroundColor: "transparent" }, texte: c.primaire, icone: c.primaire, avecOmbre: false };
      case "primaire":
      default:
        return { fond: { backgroundColor: c.primaire }, texte: "#FFFFFF", icone: "#FFFFFF", avecOmbre: true };
    }
  }, [variante]);

  const estPlein = plein ?? variante !== "fantome";
  const inactif = desactive || chargement;

  return (
    <Pressable
      disabled={inactif}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactif }}
      onPressIn={() => {
        if (inactif) return;
        echelle.value = withSpring(0.97, { damping: 18, stiffness: 350 });
        hapticLeger();
      }}
      onPressOut={() => {
        echelle.value = withSpring(1, { damping: 18, stiffness: 350 });
      }}
      style={style}
    >
      <Animated.View
        style={[
          styles.conteneur,
          estPlein ? styles.plein : styles.compact,
          palette.fond,
          palette.avecOmbre && theme.ombres.bouton,
          inactif && styles.inactif,
          anim,
        ]}
      >
        {chargement ? (
          <ActivityIndicator color={palette.texte} />
        ) : (
          <View style={styles.contenu}>
            {iconeGauche ? <Icone nom={iconeGauche} taille={20} couleur={palette.icone} style={styles.icone} /> : null}
            <Text
              style={[theme.typographie.bouton, styles.libelle, { color: palette.texte }]}
              maxFontSizeMultiplier={1.15}
            >
              {libelle}
            </Text>
            {iconeDroite ? <Icone nom={iconeDroite} taille={20} couleur={palette.icone} style={styles.icone} /> : null}
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    minHeight: 56,
    borderRadius: theme.rayons.bouton,
    paddingVertical: 14,
    justifyContent: "center",
    // S'étire pour remplir le Pressable parent (qui peut avoir flex:1).
    alignSelf: "stretch",
  },
  /** Bouton pleine largeur : padding généreux, contenu centré. */
  plein: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  /** Bouton compact (non-plein, puces, rangée) : padding réduit pour égalité de largeur. */
  compact: {
    alignItems: "center",
    paddingHorizontal: 10,
  },
  contenu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  libelle: {
    flexShrink: 1,
    textAlign: "center",
  },
  icone: {
    flexShrink: 0,
  },
  inactif: {
    opacity: 0.5,
  },
});
