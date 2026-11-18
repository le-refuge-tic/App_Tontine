// Variables d'environnement dérivées en constantes simples.

/** true si le mode démo est activé (EXPO_PUBLIC_MODE_DEMO=true). */
export const EST_MODE_DEMO =
  (process.env.EXPO_PUBLIC_MODE_DEMO ?? "false").toLowerCase() === "true";

/** URL de base de l'API, sans barre oblique finale. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/+$/, "");

/**
 * Instant de référence figé utilisé en mode démo (12 novembre 2026, 12h00
 * heure du Bénin, soit 11h00 UTC). Permet un carnet et des dates déterministes.
 */
export const DEMO_MAINTENANT_ISO = "2026-11-12T11:00:00Z";
