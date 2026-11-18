import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, tableauDeBordDemo } from "./fixtures";
import { ErreurApi, requete } from "./client";
import { preparerTransactionDemo } from "./transactions";
import type { Transaction } from "./types";

export interface ResultatRetrait {
  transaction: Transaction;
}

export interface ParamsRetrait {
  montant?: number;
  total?: boolean;
  /** Jeton de retrait à courte durée de vie (gardé en mémoire, jamais sur disque). */
  jetonRetrait: string;
}

/**
 * POST /retraits — demande un retrait vers Mobile Money.
 * TODO(backend) : la route /retraits n'existe pas encore. En mode réel, lève une
 * erreur "Fonctionnalité pas encore disponible". En mode démo, simule un retrait
 * réussi (montant retirable du fixture).
 */
export async function demanderRetrait(params: ParamsRetrait): Promise<ResultatRetrait> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const montant = params.total ? tableauDeBordDemo.retirable ?? 0 : params.montant ?? 0;
    const transaction = preparerTransactionDemo(8001, montant, "retrait");
    return { transaction: { ...transaction, statut: "reussi" } };
  }
  // TODO(backend) : implémenter POST /retraits côté serveur (avec vérification du jetonRetrait).
  void requete;
  throw new ErreurApi("Fonctionnalité pas encore disponible.");
}
