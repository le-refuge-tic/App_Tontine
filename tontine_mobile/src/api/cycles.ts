import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, cycleDemo, fabriquerJoursRattrapablesDemo } from "./fixtures";
import { requete, ErreurApi } from "./client";
import type { Cycle, CycleAvecJours, JourRattrapable } from "./types";

/** GET /cycles — cycles du membre connecté (sans jours chargés). */
export async function listerCycles(): Promise<Cycle[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [cycleDemo];
  }
  return requete<Cycle[]>("/cycles");
}

/**
 * GET /cycles/en-cours — cycle actif du membre avec ses jours.
 * Renvoie null si aucun cycle n'est en cours (404 du backend).
 */
export async function obtenirCycleEnCours(): Promise<CycleAvecJours | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return cycleDemo;
  }
  try {
    return await requete<CycleAvecJours>("/cycles/en-cours");
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 404) return null;
    throw e;
  }
}

/**
 * GET /cycles/jours-rattrapables — jours « perdu » du membre (tous cycles),
 * avec leur cycle. Utilisé pour la liste de rattrapage sur l'écran Cotiser.
 */
export async function obtenirJoursRattrapables(): Promise<JourRattrapable[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return fabriquerJoursRattrapablesDemo();
  }
  return requete<JourRattrapable[]>("/cycles/jours-rattrapables");
}
