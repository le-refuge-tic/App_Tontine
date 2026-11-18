import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, cycleDemo } from "./fixtures";
import { ErreurApi, requete } from "./client";
import { preparerTransactionDemo } from "./transactions";
import type { Transaction } from "./types";

export interface ResultatDepot {
  transaction: Transaction;
  /** URL de paiement FedaPay à ouvrir (null en mode démo / si non nécessaire). */
  urlPaiement: string | null;
}

/**
 * POST /depots — lance un dépôt (cotisation / rattrapage de jours).
 * TODO(backend) : la route /depots n'existe pas encore. En mode réel, lève une
 * erreur "Fonctionnalité pas encore disponible". En mode démo, fabrique une
 * transaction à partir des jours sélectionnés (somme de leurs montantDu).
 */
export async function lancerDepot(jourIds: number[] = []): Promise<ResultatDepot> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const montant = cycleDemo.jours
      .filter((j) => jourIds.includes(j.id))
      .reduce((s, j) => s + j.montantDu, 0);
    const transaction = preparerTransactionDemo(9001, montant, "depot");
    return { transaction, urlPaiement: null };
  }
  // TODO(backend) : implémenter POST /depots côté serveur.
  void requete; // réservé pour la future implémentation.
  throw new ErreurApi("Fonctionnalité pas encore disponible.");
}
