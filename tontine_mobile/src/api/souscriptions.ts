import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, souscriptionDemo } from "./fixtures";
import { requete, ErreurApi } from "./client";
import type { Regularite, Souscription } from "./types";

/** GET /souscriptions — toutes les souscriptions du membre connecté. */
export async function listerSouscriptions(): Promise<Souscription[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [souscriptionDemo];
  }
  return requete<Souscription[]>("/souscriptions");
}

/**
 * GET /souscriptions/active — souscription active du membre connecté.
 * Le backend renvoie 404 s'il n'y en a pas ; on retourne null dans ce cas.
 */
export async function obtenirSouscriptionActive(): Promise<Souscription | null> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return souscriptionDemo;
  }
  try {
    return await requete<Souscription>("/souscriptions/active");
  } catch (e) {
    if (e instanceof ErreurApi && e.statut === 404) return null;
    throw e;
  }
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
