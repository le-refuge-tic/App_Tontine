import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, cycleDemo } from "./fixtures";
import { requete, ErreurApi } from "./client";
import type { Cycle, CycleAvecJours } from "./types";

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
