import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, tableauDeBordDemo } from "./fixtures";
import { obtenirPortefeuille } from "./portefeuille";
import { obtenirCycleEnCours } from "./cycles";
import type { TableauDeBord } from "./types";

/**
 * Vue agrégée du portefeuille (accueil).Compose le portefeuille et le cycle
 * en cours. `retirable` vaut null en mode réel tant que la route dédiée
 * n'existe pas côté backend (TODO backend).
 */
export async function obtenirTableauDeBord(): Promise<TableauDeBord | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return tableauDeBordDemo;
  }
  const portefeuille = await obtenirPortefeuille();
  if (!portefeuille) return null;
  const cycle = await obtenirCycleEnCours();
  return {
    soldeCotisation: portefeuille.soldeCotisation,
    soldeEpargne: portefeuille.soldeEpargne,
    soldeBloque: portefeuille.soldeBloque,
    fondsCaisseRetenu: cycle?.fondsCaisseRetenu ?? 0,
    // TODO(backend) : retirable non encore exposé par le serveur.
    retirable: null,
  };
}
