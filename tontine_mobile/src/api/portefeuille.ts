import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, portefeuilleDemo, tableauDeBordDemo } from "./fixtures";
import { requete } from "./client";
import type { Portefeuille, PortefeuilleVue } from "./types";

/** GET /portefeuilles — portefeuille brut du membre (liste). */
export async function obtenirPortefeuille(): Promise<Portefeuille | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return portefeuilleDemo;
  }
  const liste = await requete<Portefeuille[]>("/portefeuilles");
  return liste[0] ?? null;
}

/**
 * GET /portefeuilles/moi — vue agrégée : soldeCotisation, soldeEpargne,
 * soldeBloque, fondsCaisseRetenu, retirable (calculé par le serveur).
 */
export async function obtenirPortefeuilleMoi(): Promise<PortefeuilleVue> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return tableauDeBordDemo;
  }
  return requete<PortefeuilleVue>("/portefeuilles/moi");
}
