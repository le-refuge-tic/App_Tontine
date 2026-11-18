import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { theme } from "@/theme";
import { MISE_MINIMALE } from "@/constants/app";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { hapticSelection } from "@/utils/haptics";
import { Icone, type NomIcone } from "./Icone";

/**
 * Sélecteur de montant de mise.
 *
 * Séparation stricte texte brut / valeur numérique validée :
 * - `texte`  : ce que l'utilisateur voit dans le champ (chiffres bruts, peut être vide).
 * - `valeur` / `onChange` : valeur numérique validée communiquée au parent, inchangée
 *   pendant la frappe — mise à jour seulement à la validation (onBlur ou boutons/puces).
 *
 * Cela évite le bug "2002" causé par le re-rendu d'un TextInput contrôlé dont la
 * value change pendant la saisie : Android insère le nouveau caractère APRÈS la valeur
 * mise à jour, produisant une concaténation parasite.
 */

interface Props {
  /** Valeur numérique validée (entier, >= minimum). */
  valeur: number;
  onChange: (montant: number) => void;
  minimum: number;
  pas: number;
  puces: readonly number[];
}

export function SelecteurMise({ valeur, onChange, minimum, pas, puces }: Props) {
  // Texte brut affiché dans le champ : uniquement des chiffres, peut être "".
  const [texte, setTexte] = useState(String(valeur));
  // Erreur affichée sous le champ si la valeur saisie est < minimum.
  const [erreur, setErreur] = useState<string | null>(null);
  // Référence pour savoir si la mise à jour vient d'un bouton/puce (externe).
  const sourceExterne = useRef(false);

  // Synchronise le texte quand le parent met à jour `valeur` depuis une puce/bouton.
  useEffect(() => {
    if (sourceExterne.current) {
      setTexte(String(valeur));
      setErreur(null);
      sourceExterne.current = false;
    }
  }, [valeur]);

  /** Valide et propage la valeur numérique ; appelé à onBlur et par les boutons/puces. */
  const valider = (n: number) => {
    if (!Number.isFinite(n) || n < minimum) {
      setErreur(`La mise minimale est de ${formaterFCFA(minimum)}`);
      // On ne modifie pas `valeur` : le parent garde sa dernière valeur valide.
      return;
    }
    setErreur(null);
    if (n !== valeur) onChange(n);
  };

  /** Gestion de la frappe : met à jour uniquement le texte, jamais la valeur. */
  const surChangement = (t: string) => {
    // N'accepte que les chiffres ; autorise le champ vide.
    const chiffresSeuls = t.replace(/\D/g, "");
    setTexte(chiffresSeuls);
    // Efface l'erreur dès que l'utilisateur recommence à taper.
    if (erreur) setErreur(null);
  };

  /** Validation au relâchement du focus. */
  const surBlur = () => {
    const n = texte === "" ? 0 : parseInt(texte, 10);
    valider(n);
    // Si invalide, ne pas laisser le texte vide ou sous-minimum affiché : on
    // laisse l'utilisateur voir son texte + le message d'erreur. On ne corrige
    // pas le texte ici pour respecter la consigne "ne pas modifier ce qu'il a tapé".
  };

  /** Bouton − : toujours valide, ne descend pas sous minimum. */
  const decrementer = () => {
    const nouveau = Math.max(minimum, valeur - pas);
    sourceExterne.current = true;
    setTexte(String(nouveau));
    setErreur(null);
    onChange(nouveau);
    hapticSelection();
  };

  /** Bouton + : toujours valide. */
  const incrementer = () => {
    const nouveau = valeur + pas;
    sourceExterne.current = true;
    setTexte(String(nouveau));
    setErreur(null);
    onChange(nouveau);
    hapticSelection();
  };

  /** Puce rapide. */
  const appliquerPuce = (p: number) => {
    sourceExterne.current = true;
    setTexte(String(p));
    setErreur(null);
    onChange(p);
    hapticSelection();
  };

  const moinsDesactive = valeur - pas < minimum;
  // La valeur affichée dans la carte récapitulative : valeur valide courante.
  const valeurAffichee = texte === "" ? null : (Number.isFinite(parseInt(texte, 10)) && parseInt(texte, 10) >= minimum ? parseInt(texte, 10) : null);

  return (
    <View>
      <View style={styles.rangee}>
        <BoutonPlusMoins
          icone="remove-outline"
          desactive={moinsDesactive}
          onAppui={decrementer}
        />

        <View style={styles.valeurConteneur}>
          <TextInput
            value={texte}
            onChangeText={surChangement}
            onBlur={surBlur}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={surBlur}
            selectTextOnFocus
            style={[
              theme.typographie.montantGrand,
              styles.valeur,
              { color: erreur ? theme.couleurs.danger : theme.couleurs.textePrimaire },
            ]}
            accessibilityLabel="Montant de la mise"
            maxFontSizeMultiplier={1.2}
          />
          <Text
            style={[theme.typographie.corps2Medium, styles.suffixe, { color: theme.couleurs.texteSecondaire }]}
            maxFontSizeMultiplier={1.2}
          >
            F
          </Text>
        </View>

        <BoutonPlusMoins icone="add-outline" onAppui={incrementer} />
      </View>

      {erreur ? (
        <Text style={[theme.typographie.legende, styles.msgErreur, { color: theme.couleurs.danger }]}>
          {erreur}
        </Text>
      ) : null}

      <View style={styles.puces}>
        {puces.map((p) => {
          const actif = valeur === p && !erreur;
          return (
            <Pressable key={p} onPress={() => appliquerPuce(p)} style={styles.puceConteneur}>
              <View style={[styles.puce, actif && styles.puceActive]}>
                <Text
                  style={[theme.typographie.corps2Medium, actif ? styles.puceTexteActive : styles.puceTexte]}
                  maxFontSizeMultiplier={1.15}
                >
                  {formaterFCFA(p)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function BoutonPlusMoins({
  icone,
  onAppui,
  desactive = false,
}: {
  icone: NomIcone;
  onAppui: () => void;
  desactive?: boolean;
}) {
  return (
    <Pressable
      disabled={desactive}
      onPress={onAppui}
      style={[styles.pmrond, desactive && styles.pmrondInactif]}
      accessibilityRole="button"
      accessibilityState={{ disabled: desactive }}
    >
      <Icone
        nom={icone}
        taille={24}
        couleur={desactive ? theme.couleurs.grisPerdu : theme.couleurs.primaire}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rangee: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  pmrond: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.couleurs.primaireTresClair,
    alignItems: "center",
    justifyContent: "center",
  },
  pmrondInactif: {
    opacity: 0.4,
  },
  valeurConteneur: {
    flex: 1,
    alignItems: "center",
  },
  valeur: {
    textAlign: "center",
    minWidth: 60,
  },
  suffixe: {
    marginTop: 2,
  },
  msgErreur: {
    textAlign: "center",
    marginTop: 6,
  },
  puces: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 20,
    justifyContent: "center",
  },
  puceConteneur: {},
  puce: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.rayons.pilule,
    backgroundColor: theme.couleurs.surface,
    borderWidth: 1,
    borderColor: theme.couleurs.bordure,
  },
  puceActive: {
    backgroundColor: theme.couleurs.primaireTresClair,
    borderColor: theme.couleurs.primaire,
  },
  puceTexte: {
    color: theme.couleurs.textePrimaire,
  },
  puceTexteActive: {
    color: theme.couleurs.primaireFonce,
  },
});
