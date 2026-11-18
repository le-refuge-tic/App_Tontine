import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, cycleDemo } from "./fixtures";
import { requete } from "./client";
import type { Cycle, CycleAvecJours, JourCotisation } from "./types";

/** GET /cycles — cycles du membre connecté (sans jours chargés). */
export async function listerCycles(): Promise<Cycle[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [cycleDemo];
  }
  return requete<Cycle[]>("/cycles");
}

/** GET /jours-cotisation — jours du membre connecté (non reliés au cycle en réponse plate). */
export async function listerJours(): Promise<JourCotisation[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return cycleDemo.jours;
  }
  return requete<JourCotisation[]>("/jours-cotisation");
}

/**
 * Cycle en cours et ses jours.
 * TODO(backend) : aucune route GET /cycles/en-cours ; les jours ne sont pas
 * reliés au cycle dans la réponse plate de /jours-cotisation. Heuristique :
 * s'il n'y a qu'un seul cycle, tous les jours lui appartiennent ; sinon jours=[].
 * En mode démo, le fixture fournit directement le cycle et ses jours.
 */
export async function obtenirCycleEnCours(): Promise<CycleAvecJours | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return cycleDemo;
  }
  const cycles = await listerCycles();
  if (cycles.length === 0) return null;
  const enCours = cycles.find((c) => c.statut === "en_cours") ?? cycles[cycles.length - 1];
  if (!enCours) return null;
  const jours = await listerJours();
  const joursCycle = cycles.length === 1 ? jours : [];
  return { ...enCours, jours: joursCycle };
}
