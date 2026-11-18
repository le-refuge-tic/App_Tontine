import { StyleSheet, View, Text } from "react-native";
import { theme } from "@/theme";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { formaterRelatif, formaterDateHeure } from "@/utils/dates";
import type { EcritureComptable, TypeEcriture } from "@/api/types";
import { Icone, type NomIcone } from "./Icone";

interface Apparence {
  icone: NomIcone;
  couleurIcone: string;
  couleurFond: string;
}

function apparencePour(type: TypeEcriture): Apparence {
  const c = theme.couleurs;
  const primaire = { icone: "arrow-down-circle-outline" as NomIcone, couleurIcone: c.primaire, couleurFond: c.primaireTresClair };
  const or = { icone: "lock-closed-outline" as NomIcone, couleurIcone: c.or, couleurFond: c.orClair };
  const sortie = { icone: "arrow-up-circle-outline" as NomIcone, couleurIcone: c.texteSecondaire, couleurFond: c.bordure };

  switch (type) {
    case "cotisation":
    case "remboursement":
    case "interet":
    case "gage_libere":
      return primaire;
    case "fonds_caisse":
    case "retenue_epargne":
    case "pret_octroye":
    case "gage_bloque":
      return or;
    case "retrait":
    case "retrait_epargne":
      return sortie;
    case "penalite":
      return { icone: "warning-outline", couleurIcone: c.avertissement, couleurFond: c.orClair };
    case "epargne":
      return { icone: "save-outline", couleurIcone: c.primaire, couleurFond: c.primaireTresClair };
    case "gage_preleve":
      return { icone: "shield-outline", couleurIcone: c.danger, couleurFond: c.orClair };
    default:
      return { icone: "ellipse-outline", couleurIcone: c.texteSecondaire, couleurFond: c.bordure };
  }
}

interface Props {
  ecriture: EcritureComptable;
}

export function LigneOperation({ ecriture }: Props) {
  const a = apparencePour(ecriture.type);
  const estCredit = ecriture.sens === "credit";
  const signe = estCredit ? "+" : "−";
  const couleurMontant = estCredit ? theme.couleurs.succes : theme.couleurs.textePrimaire;

  return (
    <View style={styles.ligne}>
      <View style={[styles.rond, { backgroundColor: a.couleurFond }]}>
        <Icone nom={a.icone} taille={20} couleur={a.couleurIcone} />
      </View>
      <View style={styles.texte}>
        <Text style={[theme.typographie.corpsMedium, { color: theme.couleurs.textePrimaire }]} numberOfLines={1}>
          {ecriture.description}
        </Text>
        <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
          {formaterRelatif(ecriture.date)} · {formaterDateHeure(ecriture.date)}
        </Text>
      </View>
      <Text style={[theme.typographie.montantPetit, styles.montant, { color: couleurMontant }]} maxFontSizeMultiplier={1.15}>
        {signe}
        {formaterFCFA(ecriture.montant)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  rond: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  texte: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  montant: {
    flexShrink: 0,
  },
});
