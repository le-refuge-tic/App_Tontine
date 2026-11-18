import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { hapticSelection, hapticErreur } from "@/utils/haptics";
import { Icone, type NomIcone } from "./Icone";

interface Props {
  /** Nombre de chiffres (4 à 6). */
  longueur?: number;
  onComplet: (code: string) => void;
  titre?: string;
  sousTitre?: string;
  /** Message d'erreur affiché sous les points. */
  erreur?: string | null;
  /** Changer cette valeur réinitialise la saisie (ex : un compteur). */
  cleReinit?: unknown;
}

const TOUCHES: (string | null)[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "effacer"];

export function ClavierCode({ longueur = 4, onComplet, titre, sousTitre, erreur, cleReinit }: Props) {
  const [code, setCode] = useState("");

  useEffect(() => {
    setCode("");
  }, [cleReinit]);

  useEffect(() => {
    if (code.length === longueur) {
      onComplet(code);
    }
  }, [code, longueur, onComplet]);

  useEffect(() => {
    if (erreur) hapticErreur();
  }, [erreur]);

  const taper = (t: string) => {
    if (code.length >= longueur) return;
    hapticSelection();
    setCode((c) => c + t);
  };

  const effacer = () => {
    setCode((c) => c.slice(0, -1));
  };

  return (
    <View style={styles.conteneur}>
      {titre ? <Text style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>{titre}</Text> : null}
      {sousTitre ? <Text style={[theme.typographie.corps2, styles.sousTitre, { color: theme.couleurs.texteSecondaire }]}>{sousTitre}</Text> : null}

      <View style={styles.points}>
        {Array.from({ length: longueur }).map((_, i) => (
          <View key={i} style={[styles.point, i < code.length && styles.pointPlein, erreur && styles.pointErreur]} />
        ))}
      </View>
      {erreur ? <Text style={[theme.typographie.legende, { color: theme.couleurs.danger, textAlign: "center" }]}>{erreur}</Text> : null}

      <View style={styles.pave}>
        {TOUCHES.map((t, i) =>
          t === null ? (
            <View key={i} style={styles.touche} />
          ) : t === "effacer" ? (
            <Pressable key={i} onPress={effacer} style={styles.touche}>
              <Icone nom="backspace-outline" taille={26} couleur={theme.couleurs.texteSecondaire} />
            </Pressable>
          ) : (
            <Pressable key={i} onPress={() => taper(t)} style={({ pressed }) => [styles.touche, styles.toucheChiffre, pressed && styles.touchePresse]}>
              <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire }]}>{t}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: {
    gap: 8,
  },
  sousTitre: {
    textAlign: "center",
    marginBottom: 8,
  },
  points: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginVertical: 14,
  },
  point: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: theme.couleurs.bordure,
    backgroundColor: "transparent",
  },
  pointPlein: {
    backgroundColor: theme.couleurs.primaire,
    borderColor: theme.couleurs.primaire,
  },
  pointErreur: {
    borderColor: theme.couleurs.danger,
    backgroundColor: theme.couleurs.danger,
  },
  pave: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: 8,
  },
  touche: {
    width: "32%",
    aspectRatio: 1.4,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 4,
  },
  toucheChiffre: {},
  touchePresse: {
    opacity: 0.4,
  },
});
