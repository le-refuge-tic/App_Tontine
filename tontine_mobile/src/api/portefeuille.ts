import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, portefeuilleDemo } from "./fixtures";
import { requete } from "./client";
import type { Portefeuille } from "./types";

/** GET /portefeuilles — portefeuille du membre connecté (tableau, on prend le premier). */
export async function obtenirPortefeuille(): Promise<Portefeuille | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return portefeuilleDemo;
  }
  const liste = await requete<Portefeuille[]>("/portefeuilles");
  return liste[0] ?? null;
}
