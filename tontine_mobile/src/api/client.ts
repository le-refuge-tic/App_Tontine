import { API_URL } from "@/constants/env";
import { DELAI_TIMEOUT_REQUETE_MS } from "@/constants/app";
import { getAccessToken, getRefreshToken, setJetons, effacerJetons } from "./jetons";

// Garde URL : lève une erreur claire si la variable n'est pas configurée.
if (!API_URL || API_URL.includes("IP_DU_PC")) {
  console.warn(
    "[API] EXPO_PUBLIC_API_URL est vide ou contient « IP_DU_PC ». " +
      "Remplacez-la par l'adresse IP réelle du serveur dans .env (ex. http://192.168.1.42:3000/api/v1).",
  );
}

/** Erreur normalisée : message en français (du serveur ou par défaut), statut HTTP éventuel. */
export class ErreurApi extends Error {
  constructor(message: string, public statut?: number) {
    super(message);
    this.name = "ErreurApi";
  }
}

/** Rappel déclenché quand la session est perdue (rafraîchissement impossible). */
let rappelSessionPerdue: (() => void) | null = null;
export function definirRappelSessionPerdue(cb: () => void): void {
  rappelSessionPerdue = cb;
}

function messageParDefaut(statut: number): string {
  switch (statut) {
    case 400:
      return "Données invalides.";
    case 401:
      return "Session expirée, reconnectez-vous.";
    case 403:
      return "Action non autorisée.";
    case 404:
      return "Ressource introuvable.";
    case 409:
      return "Opération déjà en cours ou en conflit.";
    case 422:
      return "Montant ou données non valides.";
    case 429:
      return "Trop de tentatives. Patientez un instant.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Le serveur rencontre un problème. Réessayez plus tard.";
    default:
      return "Une erreur est survenue.";
  }
}

function messageDepuisCorps(corps: unknown, statut: number): string {
  if (corps && typeof corps === "object" && "message" in corps) {
    const m = (corps as { message: unknown }).message;
    if (typeof m === "string" && m.length > 0) return m;
    if (Array.isArray(m) && m.length > 0 && typeof m[0] === "string") return m[0];
  }
  if (corps && typeof corps === "object" && "error" in corps) {
    const e = (corps as { error: unknown }).error;
    if (typeof e === "string" && e.length > 0) return e;
  }
  if (typeof corps === "string" && corps.length > 0) return corps;
  return messageParDefaut(statut);
}

function estAbort(e: unknown): boolean {
  if (e instanceof Error) {
    return e.name === "AbortError" || /abort/i.test(e.message);
  }
  return false;
}

// ── Rafraîchissement à vol unique ──────────────────────────────────────────
let refreshEnCours: Promise<string> | null = null;

async function rafraichirJeton(): Promise<string> {
  if (refreshEnCours) return refreshEnCours;
  refreshEnCours = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new ErreurApi("Session expirée, reconnectez-vous.", 401);

    const controleur = new AbortController();
    const t = setTimeout(() => controleur.abort(), DELAI_TIMEOUT_REQUETE_MS);
    try {
      const res = await fetch(`${API_URL}/auth/rafraichir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal: controleur.signal,
      });
      if (!res.ok) {
        const corps = await res.json().catch(() => null);
        throw new ErreurApi(messageDepuisCorps(corps, res.status), res.status);
      }
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      await setJetons(data.accessToken, data.refreshToken);
      return data.accessToken;
    } catch (e) {
      if (e instanceof ErreurApi) throw e;
      if (estAbort(e)) throw new ErreurApi("Le serveur met trop de temps à répondre.");
      throw new ErreurApi("Impossible de joindre le serveur. Vérifiez le Wi-Fi et l'adresse du serveur.");
    } finally {
      clearTimeout(t);
      refreshEnCours = null;
    }
  })();
  return refreshEnCours;
}

export interface OptionsRequete {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Requête sans jeton (routes publiques). */
  sansAuth?: boolean;
  /** Réponse en texte brut (ex : jeton de retrait), pas de JSON. */
  brut?: boolean;
}

async function executer<T>(chemin: string, options: OptionsRequete, dejaRafraichi: boolean): Promise<T> {
  // Vérifie la configuration de l'URL avant d'envoyer la requête.
  if (!API_URL || API_URL.includes("IP_DU_PC")) {
    throw new ErreurApi(
      "L'adresse du serveur n'est pas configurée. " +
        "Renseignez EXPO_PUBLIC_API_URL dans .env (ex. http://192.168.1.42:3000/api/v1).",
    );
  }

  const { method = "GET", body, sansAuth = false, brut = false } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!sansAuth) {
    const access = await getAccessToken();
    if (access) headers["Authorization"] = `Bearer ${access}`;
  }

  const controleur = new AbortController();
  const t = setTimeout(() => controleur.abort(), DELAI_TIMEOUT_REQUETE_MS);

  try {
    const res = await fetch(`${API_URL}${chemin}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controleur.signal,
    });

    if (res.status === 401 && !sansAuth && !dejaRafraichi) {
      try {
        await rafraichirJeton();
        return executer<T>(chemin, options, true);
      } catch {
        await effacerJetons();
        rappelSessionPerdue?.();
        throw new ErreurApi("Session expirée, reconnectez-vous.", 401);
      }
    }

    if (res.status === 204) {
      return undefined as T;
    }

    const texteBrut = await res.text();

    if (!res.ok) {
      let corps: unknown = texteBrut;
      if (texteBrut) {
        try {
          corps = JSON.parse(texteBrut);
        } catch {
          /* corps reste le texte brut */
        }
      }
      throw new ErreurApi(messageDepuisCorps(corps, res.status), res.status);
    }

    if (brut) {
      return texteBrut as unknown as T;
    }

    if (!texteBrut) {
      return undefined as T;
    }
    return JSON.parse(texteBrut) as T;
  } catch (e) {
    if (e instanceof ErreurApi) throw e;
    if (estAbort(e)) throw new ErreurApi("Le serveur met trop de temps à répondre.");
    throw new ErreurApi("Impossible de joindre le serveur. Vérifiez le Wi-Fi et l'adresse du serveur.");
  } finally {
    clearTimeout(t);
  }
}

/** Effectue une requête typée vers l'API. Gère le rafraîchissement automatique du jeton. */
export function requete<T>(chemin: string, options: OptionsRequete = {}): Promise<T> {
  return executer<T>(chemin, options, false);
}
