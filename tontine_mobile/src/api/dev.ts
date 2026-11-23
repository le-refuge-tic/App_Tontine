import { requete } from "./client";
import { API_URL } from "@/constants/env";

/**
 * POST /dev/simuler-webhook — simule un webhook FedaPay en développement.
 * Disponible uniquement si NODE_ENV=development côté backend.
 *
 * @param transactionId  Identifiant interne de la transaction.
 * @param resultat       "approuve" → statut reussi, "refuse" → statut echoue.
 */
export async function simulerWebhook(
  transactionId: number,
  resultat: "approuve" | "refuse",
): Promise<void> {
  await requete<void>("/dev/simuler-webhook", {
    method: "POST",
    body: { transactionId, resultat },
  });
}

/**
 * Teste la connectivité au serveur en appelant GET /api/docs
 * (route publique toujours disponible).
 * Renvoie "ok" ou un message d'erreur.
 */
export async function testerConnexionServeur(): Promise<{ ok: boolean; message: string }> {
  if (!API_URL || API_URL.includes("IP_DU_PC")) {
    return { ok: false, message: "URL de l'API non configurée." };
  }
  try {
    const res = await fetch(`${API_URL.replace("/api/v1", "")}/api/docs`, {
      method: "HEAD",
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok || res.status === 301 || res.status === 302 || res.status === 200) {
      return { ok: true, message: `HTTP ${res.status} — serveur joignable` };
    }
    return { ok: false, message: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Erreur inconnue" };
  }
}
