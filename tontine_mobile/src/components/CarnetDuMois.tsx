import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { dateJourBeninISO } from "@/utils/dates";
import { hapticSelection } from "@/utils/haptics";
import { Icone } from "./Icone";
import type { JourCotisation } from "@/api/types";

interface Props {
  jours: JourCotisation[];
  /** Mode rattrapage : les jours perdus / à payer passés deviennent sélectionnables. */
  modeSelection?: boolean;
  /** Identifiants des jours sélectionnés pour le rattrapage. */
  joursSelectionnes?: number[];
  onToggleJour?: (jourId: number) => void;
}

const GAP = 8;

export function CarnetDuMois({ jours, modeSelection = false, joursSelectionnes = [], onToggleJour }: Props) {
  const [largeur, setLargeur] = useState(0);
  const aujourdhui = dateJourBeninISO();
  const cellule = Math.max(0, Math.floor((largeur - 6 * GAP) / 7));
  const tries = new Set(joursSelectionnes);

  return (
    <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
      <View style={[styles.grille, largeur ? null : styles.cache]}>
        {jours.map((jour) => {
          const estAujourdhui = jour.datePrevue === aujourdhui;
          const selectionne = modeSelection && tries.has(jour.id);
          const selectionnable = modeSelection && jourSelectionnable(jour, aujourdhui);
          return (
            <Cellule
              key={jour.id}
              jour={jour}
              taille={cellule}
              estAujourdhui={estAujourdhui}
              selectionne={selectionne}
              selectionnable={selectionnable}
              onAppui={() => selectionnable && onToggleJour?.(jour.id)}
            />
          );
        })}
      </View>
      <Legende />
    </View>
  );
}

function jourSelectionnable(jour: JourCotisation, aujourdhui: string): boolean {
  if (jour.statut === "perdu") return true;
  if (jour.statut === "a_payer" && jour.datePrevue < aujourdhui) return true;
  return false;
}

interface PropsCellule {
  jour: JourCotisation;
  taille: number;
  estAujourdhui: boolean;
  selectionne: boolean;
  selectionnable: boolean;
  onAppui: () => void;
}

function Cellule({ jour, taille, estAujourdhui, selectionne, selectionnable, onAppui }: PropsCellule) {
  const c = theme.couleurs;
  let fond: string = "transparent";
  let bordure: string = c.bordure;
  let bordureWidth = 1;
  let texteCouleur: string = c.texteSecondaire;
  let avecCoche = false;
  let avecBarre = false;
  let avecPoint = false;

  if (selectionne) {
    fond = c.primaireTresClair;
    bordure = c.primaire;
    bordureWidth = 1.5;
    texteCouleur = c.primaireFonce;
    avecCoche = true;
  } else {
    switch (jour.statut) {
      case "paye":
        fond = c.primaire;
        bordure = c.primaire;
        texteCouleur = "#FFFFFF";
        avecCoche = true;
        break;
      case "rattrape":
        fond = c.primaireTresClair;
        bordure = c.primaireTresClair;
        texteCouleur = c.primaireFonce;
        avecCoche = true;
        break;
      case "perdu":
        fond = "transparent";
        bordure = c.bordure;
        texteCouleur = c.grisPerdu;
        avecBarre = true;
        break;
      case "a_payer":
      default:
        if (estAujourdhui) {
          bordure = c.primaire;
          bordureWidth = 2;
          texteCouleur = c.primaire;
          avecPoint = true;
        } else {
          bordure = c.bordure;
          texteCouleur = c.texteSecondaire;
        }
        break;
    }
  }

  return (
    <Pressable
      disabled={!selectionnable}
      onPress={onAppui}
      onPressIn={() => selectionnable && hapticSelection()}
      style={{ width: taille, height: taille }}
    >
      <View style={[styles.cellule, { backgroundColor: fond, borderColor: bordure, borderWidth: bordureWidth }]}>
        {avecCoche ? (
          <Icone nom="checkmark" taille={16} couleur={texteCouleur} />
        ) : (
          <Text style={[theme.typographie.corpsMedium, { color: texteCouleur }]}>{jour.numeroJour}</Text>
        )}
        {avecBarre ? <View style={styles.barreCellule} /> : null}
        {avecPoint ? <View style={[styles.pointBas, { backgroundColor: c.primaire }]} /> : null}
      </View>
      {jour.coefficient > 1 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeTexte}>×{jour.coefficient}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Legende() {
  const items: { couleur: string; libelle: string }[] = [
    { couleur: theme.couleurs.primaire, libelle: "Payé" },
    { couleur: theme.couleurs.primaireTresClair, libelle: "Rattrapé" },
    { couleur: theme.couleurs.bordure, libelle: "À payer" },
    { couleur: theme.couleurs.primaire, libelle: "Aujourd'hui" },
    { couleur: theme.couleurs.grisPerdu, libelle: "Perdu" },
  ];
  return (
    <View style={styles.legende}>
      {items.map((it, i) => (
        <View key={i} style={styles.legendeItem}>
          <View style={[styles.legendePoint, { backgroundColor: it.couleur }]} />
          <Text style={[theme.typographie.legende2, { color: theme.couleurs.texteSecondaire }]}>{it.libelle}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grille: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  cache: {
    opacity: 0,
  },
  cellule: {
    flex: 1,
    borderRadius: theme.rayons.case,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  barreCellule: {
    position: "absolute",
    left: 6,
    right: 6,
    top: "50%",
    height: 1.5,
    backgroundColor: theme.couleurs.grisPerdu,
    borderRadius: 999,
  },
  pointBas: {
    position: "absolute",
    bottom: 5,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: theme.couleurs.or,
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: "center",
  },
  badgeTexte: {
    ...theme.typographie.badge,
    color: theme.couleurs.primaireFonce,
  },
  legende: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 18,
  },
  legendeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendePoint: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
