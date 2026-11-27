import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, cycleDemo, fabriquerJoursRattrapablesDemo } from "./fixtures";
import { requete } from "./client";
import { preparerTransactionDemo } from "./transactions";
import type { Transaction } from "./types";

export interface ResultatDepot {
  transaction: Transaction;
  /** URL de paiement FedaPay à ouvrir dans le navigateur intégré. Null en démo ou double-clic. */
  urlPaiement: string | null;
}

/**
 * POST /depots — lance un dépôt (cotisation du jour ou rattrapage).
 *
 * Sans `jourIds` ou tableau vide → paie le jour d'aujourd'hui.
 * Avec `jourIds`                → rattrapage des jours fournis.
 *
 * Le serveur renvoie { transaction, urlPaiement }. `urlPaiement` peut être null
 * si une transaction en_attente identique a été réutilisée (anti-double-clic).
 */
export async function lancerDepot(jourIds: number[] = []): Promise<ResultatDepot> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    // Chercher dans les jours du cycle en cours ET dans les jours rattrapables.
    const tousLesJours = [
      ...cycleDemo.jours,
      ...fabriquerJoursRattrapablesDemo(),
    ];
    const montant = jourIds.length > 0
      ? tousLesJours
          .filter((j) => jourIds.includes(j.id))
          .reduce((s, j) => s + j.montantDu, 0)
      : cycleDemo.miseBase;
    const transaction = preparerTransactionDemo(9001, montant > 0 ? montant : cycleDemo.miseBase, "depot");
    return { transaction, urlPaiement: null };
  }

  const body: { jourIds?: number[] } = {};
  if (jourIds.length > 0) body.jourIds = jourIds;

  return requete<ResultatDepot>("/depots", {
    method: "POST",
    body,
  });
}
