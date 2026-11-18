import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, prochaineTransactionDemo, enregistrerTransactionDemo } from "./fixtures";
import { requete } from "./client";
import type { Transaction } from "./types";

/** GET /transactions — transactions Mobile Money du membre. */
export async function listerTransactions(): Promise<Transaction[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [];
  }
  return requete<Transaction[]>("/transactions");
}

/** GET /transactions/:id — statut d'une transaction (pour le polling de paiement). */
export async function obtenirTransaction(id: number): Promise<Transaction> {
  if (EST_MODE_DEMO) {
    await delaiDemo(800);
    const t = prochaineTransactionDemo(id);
    if (!t) throw new Error("Transaction démo introuvable.");
    return t;
  }
  return requete<Transaction>(`/transactions/${id}`);
}

/** Réserve un identifiant de transaction démo (utilisé par les flux de démo). */
export function preparerTransactionDemo(id: number, montant: number, type: "depot" | "retrait"): Transaction {
  return enregistrerTransactionDemo(id, montant, type);
}
