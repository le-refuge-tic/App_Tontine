import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, tableauDeBordDemo } from "./fixtures";
import { requete } from "./client";
import { preparerTransactionDemo } from "./transactions";
import type { Transaction } from "./types";

export interface ResultatRetrait {
  transaction: Transaction;
}

export interface ParamsRetrait {
  montant?: number;
  total?: boolean;
  /** Jeton de retrait JWT à courte durée de vie (gardé en mémoire, jamais sur disque). */
  jetonRetrait: string;
}

/**
 * POST /retraits — demande un retrait vers Mobile Money.
 *
 * Corps : { montant?, total?, jetonRetrait }.
 * `montant` et `total` sont exclusifs (l'un ou l'autre).
 * Le jeton est à usage unique ; si le serveur renvoie 401 après consommation,
 * en redemander un via POST /auth/code-retrait/verifier.
 *
 * Codes d'erreur attendus :
 *   422 – montant trop élevé ou solde nul
 *   409 – retrait déjà en cours
 *   401 – jeton invalide / expiré / déjà utilisé
 *   503 – service de paiement indisponible
 */
export async function demanderRetrait(params: ParamsRetrait): Promise<ResultatRetrait> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const montant = params.total ? (tableauDeBordDemo.retirable ?? 0) : (params.montant ?? 0);
    const transaction = preparerTransactionDemo(8001, montant, "retrait");
    return { transaction: { ...transaction, statut: "reussi" } };
  }

  const body: Record<string, unknown> = { jetonRetrait: params.jetonRetrait };
  if (params.total === true) {
    body.total = true;
  } else if (params.montant !== undefined) {
    body.montant = params.montant;
  }

  return requete<ResultatRetrait>("/retraits", {
    method: "POST",
    body,
  });
}
