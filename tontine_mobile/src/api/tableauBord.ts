import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, tableauDeBordDemo } from "./fixtures";
import { obtenirPortefeuilleMoi } from "./portefeuille";
import type { TableauDeBord } from "./types";

/**
 * Vue agrégée du portefeuille (accueil).
 *
 * Mode réel : GET /portefeuilles/moi renvoie directement soldeCotisation,
 * soldeEpargne, soldeBloque, fondsCaisseRetenu et retirable (calculés par le
 * serveur). Plus besoin de combiner deux requêtes.
 */
export async function obtenirTableauDeBord(): Promise<TableauDeBord> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return tableauDeBordDemo;
  }
  return obtenirPortefeuilleMoi();
}
