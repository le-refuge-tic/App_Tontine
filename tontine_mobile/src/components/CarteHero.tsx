import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { theme } from "@/theme";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { hapticLeger } from "@/utils/haptics";
import { BarreProgression } from "./BarreProgression";
import { Icone, type NomIcone } from "./Icone";

interface Props {
  soldeCotise: number;
  jourCourant: number;
  totalJours: number;
  onCotiser: () => void;
  onRetirer: () => void;
  desactiveRetirer?: boolean;
}

export function CarteHero({ soldeCotise, jourCourant, totalJours, onCotiser, onRetirer, desactiveRetirer }: Props) {
  const progression = totalJours > 0 ? jourCourant / totalJours : 0;

  return (
    <LinearGradient
      colors={[theme.couleurs.primaireFonce, theme.couleurs.primaire]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.carte}
    >
      <Text style={[theme.typographie.corps2Medium, styles.label]} maxFontSizeMultiplier={1.1}>Solde cotisé</Text>
      <Text style={[theme.typographie.heroMontant, styles.montant]} adjustsFontSizeToFit numberOfLines={1} maxFontSizeMultiplier={1.0}>{formaterFCFA(soldeCotise)}</Text>

      <View style={styles.statut}>
        <Text style={[theme.typographie.corps2Medium, styles.statutTexte]} maxFontSizeMultiplier={1.15}>
          Jour {jourCourant} sur {totalJours}
        </Text>
        <BarreProgression
          valeur={progression}
          hauteur={6}
          couleurRemplissage={theme.couleurs.or}
          couleurFond="rgba(255,255,255,0.22)"
        />
      </View>

      <View style={styles.boutons}>
        <BoutonHero libelle="Cotiser" icone="arrow-down-circle-outline" plein onPress={onCotiser} />
        <BoutonHero libelle="Retirer" icone="arrow-up-circle-outline" onPress={onRetirer} desactive={desactiveRetirer} />
      </View>
    </LinearGradient>
  );
}

function BoutonHero({
  libelle,
  icone,
  plein = false,
  onPress,
  desactive = false,
}: {
  libelle: string;
  icone: NomIcone;
  plein?: boolean;
  onPress: () => void;
  desactive?: boolean;
}) {
  const echelle = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: echelle.value }] }));

  return (
    <Pressable
      disabled={desactive}
      onPress={onPress}
      onPressIn={() => {
        if (desactive) return;
        echelle.value = withSpring(0.96, { damping: 18, stiffness: 320 });
        hapticLeger();
      }}
      onPressOut={() => {
        echelle.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      style={styles.boutonConteneur}
    >
      <Animated.View
        style={[
          styles.bouton,
          plein ? styles.boutonPlein : styles.boutonContour,
          desactive && styles.boutonInactif,
          anim,
        ]}
      >
        <Icone nom={icone} taille={20} couleur={plein ? theme.couleurs.primaireFonce : "#FFFFFF"} />
        <Text style={[theme.typographie.bouton, plein ? styles.boutonPleinTexte : styles.boutonContourTexte]} maxFontSizeMultiplier={1.1}>
          {libelle}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  carte: {
    borderRadius: theme.rayons.carte,
    padding: 24,
    ...theme.ombres.carteElevee,
  },
  label: {
    color: "rgba(255,255,255,0.78)",
  },
  montant: {
    color: "#FFFFFF",
    marginTop: 6,
  },
  statut: {
    marginTop: 20,
    gap: 8,
  },
  statutTexte: {
    color: "rgba(255,255,255,0.9)",
  },
  boutons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },
  boutonConteneur: {
    flex: 1,
  },
  bouton: {
    height: 52,
    borderRadius: theme.rayons.bouton,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  boutonPlein: {
    backgroundColor: "#FFFFFF",
  },
  boutonContour: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.65)",
  },
  boutonInactif: {
    opacity: 0.45,
  },
  boutonPleinTexte: {
    color: theme.couleurs.primaireFonce,
  },
  boutonContourTexte: {
    color: "#FFFFFF",
  },
});
