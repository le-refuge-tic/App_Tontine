import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { theme } from "@/theme";
import { hapticSelection } from "@/utils/haptics";

export interface OptionSegmente {
  valeur: string;
  libelle: string;
}

interface Props {
  options: OptionSegmente[];
  valeur: string;
  onChange: (valeur: string) => void;
  /** Conteneur wrapper (ex : style_wrapper pour Rapport). */
  style_wrapper?: import("react-native").ViewStyle;
}

export function ControleSegmente({ options, valeur, onChange, style_wrapper }: Props) {
  const [largeur, setLargeur] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.valeur === valeur));
  const segmentLargeur = largeur / Math.max(1, options.length);

  const gauche = useSharedValue(0);
  useEffect(() => {
    gauche.value = withTiming(index * segmentLargeur, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, [index, segmentLargeur, gauche]);
  const indic = useAnimatedStyle(() => ({ transform: [{ translateX: gauche.value }] }));

  return (
    <View
      style={[styles.conteneur, style_wrapper]}
      onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[styles.indicateur, { width: segmentLargeur }, indic]}
        pointerEvents="none"
      />
      {options.map((o) => {
        const actif = o.valeur === valeur;
        return (
          <Pressable
            key={o.valeur}
            onPress={() => {
              if (!actif) {
                hapticSelection();
                onChange(o.valeur);
              }
            }}
            style={styles.segment}
          >
            <Text style={[theme.typographie.corps2Medium, actif ? styles.texteActif : styles.texteInactif]}>
              {o.libelle}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    flexDirection: "row",
    backgroundColor: theme.couleurs.fond,
    borderRadius: theme.rayons.pilule,
    padding: 4,
    position: "relative",
  },
  indicateur: {
    position: "absolute",
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: theme.rayons.pilule,
    backgroundColor: theme.couleurs.surface,
    ...theme.ombres.carte,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  texteActif: {
    color: theme.couleurs.primaire,
  },
  texteInactif: {
    color: theme.couleurs.texteSecondaire,
  },
});
