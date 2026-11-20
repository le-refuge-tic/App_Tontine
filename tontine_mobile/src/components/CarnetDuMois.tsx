import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/theme";
import { dateJourBeninISO } from "@/utils/dates";
import { hapticSelection } from "@/utils/haptics";
import { Icone } from "./Icone";
import type { JourCotisation } from "@/api/types";

interface Props {
  jours: JourCotisation[];
  /**
   * Premier jour du cycle (AAAA-MM-JJ). Avec dateFin, permet d'afficher
   * tous les jours calendaires du mois en grisé hors-cycle.
   */
  dateDebut?: string;
  /** Dernier jour du cycle (AAAA-MM-JJ). */
  dateFin?: string;
  /** Mode rattrapage : les jours perdus / à payer passés deviennent sélectionnables. */
  modeSelection?: boolean;
  /** Identifiants des jours sélectionnés pour le rattrapage. */
  joursSelectionnes?: number[];
  onToggleJour?: (jourId: number) => void;
}

const GAP = 8;

/** Nombre de jours dans le mois d'une date AAAA-MM-JJ. */
function joursParMois(dateISO: string): number {
  const [annee, mois] = dateISO.split("-").map(Number);
  return new Date(annee!, mois!, 0).getDate();
}

/** Extrait le numéro de jour (1-31) depuis une date AAAA-MM-JJ. */
function jourDuMois(dateISO: string): number {
  return parseInt(dateISO.split("-")[2]!, 10);
}

/**
 * Représentation interne d'une case de la grille.
 * - type "cycle"    : jour appartenant au cycle, possède toutes les données JourCotisation.
 * - type "horsCycle": jour calendaire hors du cycle, affiché en gris.
 */
type Case =
  | { type: "cycle"; jour: JourCotisation }
  | { type: "horsCycle"; numeroJour: number };

export function CarnetDuMois({
  jours,
  dateDebut,
  dateFin,
  modeSelection = false,
  joursSelectionnes = [],
  onToggleJour,
}: Props) {
  const [largeur, setLargeur] = useState(0);
  const aujourdhui = dateJourBeninISO();
  const cellule = Math.max(0, Math.floor((largeur - 6 * GAP) / 7));
  const tries = new Set(joursSelectionnes);

  // Construction de la grille : jours hors-cycle + jours du cycle.
  const cases: Case[] = (() => {
    if (!dateDebut || !dateFin) {
      // Pas de dates fournies : on affiche uniquement les jours du cycle (ancien comportement).
      return jours.map((j): Case => ({ type: "cycle", jour: j }));
    }

    const totalJours = joursParMois(dateDebut);
    const premierJourCycle = jourDuMois(dateDebut);
    const dernierJourCycle = jourDuMois(dateFin);

    // Index des jours du cycle par leur numéro de jour dans le mois.
    const jourParNumero = new Map<number, JourCotisation>();
    for (const j of jours) {
      jourParNumero.set(j.numeroJour, j);
    }

    const resultat: Case[] = [];
    for (let n = 1; n <= totalJours; n++) {
      const dansLeCycle = n >= premierJourCycle && n <= dernierJourCycle;
      if (dansLeCycle) {
        const jour = jourParNumero.get(n);
        if (jour) {
          resultat.push({ type: "cycle", jour });
        } else {
          // Jour dans la plage mais sans données (ne devrait pas arriver) : hors-cycle.
          resultat.push({ type: "horsCycle", numeroJour: n });
        }
      } else {
        resultat.push({ type: "horsCycle", numeroJour: n });
      }
    }
    return resultat;
  })();

  const aDesHorsCycle = cases.some((c) => c.type === "horsCycle");

  return (
    <View onLayout={(e) => setLargeur(e.nativeEvent.layout.width)}>
      <View style={[styles.grille, largeur ? null : styles.cache]}>
        {cases.map((c, i) => {
          if (c.type === "horsCycle") {
            return (
              <CelluleHorsCycle
                key={`hors-${c.numeroJour}`}
                numeroJour={c.numeroJour}
                taille={cellule}
              />
            );
          }
          const jour = c.jour;
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
      <Legende avecHorsCycle={aDesHorsCycle} />
    </View>
  );
}

function jourSelectionnable(jour: JourCotisation, aujourdhui: string): boolean {
  if (jour.statut === "perdu") return true;
  if (jour.statut === "a_payer" && jour.datePrevue < aujourdhui) return true;
  return false;
}

// ── Cellule hors-cycle ─────────────────────────────────────────────────────

function CelluleHorsCycle({ numeroJour, taille }: { numeroJour: number; taille: number }) {
  return (
    <View style={{ width: taille, height: taille }}>
      <View
        style={[
          styles.cellule,
          {
            backgroundColor: theme.couleurs.grisPerdu,
            borderColor: theme.couleurs.grisPerdu,
            borderWidth: 1,
          },
        ]}
      >
        <Text style={[theme.typographie.corpsMedium, { color: "#FFFFFF" }]}>
          {numeroJour}
        </Text>
      </View>
    </View>
  );
}

// ── Cellule du cycle ───────────────────────────────────────────────────────

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
      </View>
      {jour.coefficient > 1 ? (
        <View style={styles.badge} pointerEvents="none">
          <Text style={styles.badgeTexte}>×{jour.coefficient}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ── Légende ────────────────────────────────────────────────────────────────

function Legende({ avecHorsCycle }: { avecHorsCycle: boolean }) {
  const items: { couleur: string; libelle: string; contour?: boolean }[] = [
    { couleur: theme.couleurs.primaire, libelle: "Payé" },
    { couleur: theme.couleurs.primaireTresClair, libelle: "Rattrapé" },
    { couleur: theme.couleurs.bordure, libelle: "À payer", contour: true },
    { couleur: theme.couleurs.primaire, libelle: "Aujourd'hui", contour: true },
    { couleur: theme.couleurs.grisPerdu, libelle: "Perdu" },
  ];
  if (avecHorsCycle) {
    items.push({ couleur: theme.couleurs.grisPerdu, libelle: "Hors cycle" });
  }
  return (
    <View style={styles.legende}>
      {items.map((it, i) => (
        <View key={i} style={styles.legendeItem}>
          <View
            style={[
              styles.legendePoint,
              {
                backgroundColor: it.contour ? "transparent" : it.couleur,
                borderColor: it.couleur,
                borderWidth: it.contour ? 1.5 : 0,
              },
            ]}
          />
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
