import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, souscriptionDemo } from "./fixtures";
import { requete } from "./client";
import type { Regularite, Souscription } from "./types";

/** GET /souscriptions — souscriptions du membre connecté. */
export async function listerSouscriptions(): Promise<Souscription[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [souscriptionDemo];
  }
  return requete<Souscription[]>("/souscriptions");
}

/** Souscription active du membre (filtrée côté client depuis GET /souscriptions). */
export async function obtenirSouscriptionActive(): Promise<Souscription | null> {
  const liste = await listerSouscriptions();
  return liste.find((s) => s.statut === "active") ?? null;
}

/**
 * POST /souscriptions — crée la souscription pour le membre connecté.
 * Le serveur déduit le membre depuis le jeton JWT.
 */
export async function creerSouscription(params: {
  miseBase: number;
  regularite: Regularite;
}): Promise<Souscription> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return souscriptionDemo;
  }
  return requete<Souscription>("/souscriptions", {
    method: "POST",
    body: { miseBase: params.miseBase, regularite: params.regularite },
  });
}
