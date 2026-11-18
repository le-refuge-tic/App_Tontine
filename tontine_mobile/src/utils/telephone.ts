import { PREFIXE_TELEPHONE, LONGUEUR_TELEPHONE_LOCAL } from "@/constants/app";

/** Longueur du numéro complet avec préfixe (229 + 10 chiffres = 13). */
const LONGUEUR_COMPLETE = PREFIXE_TELEPHONE.length + LONGUEUR_TELEPHONE_LOCAL;

/** Extrait uniquement les chiffres d'une saisie. */
function chiffres(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Normalise un numéro saisi pour l'envoi à l'API : "229" + 10 chiffres.
 * Accepte :
 *   - 10 chiffres locaux (ex: "0197000000")
 *   - 13 chiffres avec préfixe (ex: "2290197000000")
 *   - Formats avec espaces, +, tirets (nettoyés automatiquement)
 * Renvoie null si le nombre de chiffres est incorrect.
 */
export function normaliserTelephonePourEnvoi(saisie: string): string | null {
  const d = chiffres(saisie);
  if (d.length === LONGUEUR_TELEPHONE_LOCAL) return `${PREFIXE_TELEPHONE}${d}`;
  if (d.length === LONGUEUR_COMPLETE && d.startsWith(PREFIXE_TELEPHONE)) return d;
  return null;
}

/** Valide une saisie de numéro béninois (10 chiffres locaux). */
export function validerTelephoneBenin(saisie: string): boolean {
  return chiffres(saisie).length === LONGUEUR_TELEPHONE_LOCAL;
}

/**
 * Filtre la saisie pour ne garder que les chiffres locaux (sans préfixe).
 * Utilisé dans onChangeText pour alimenter l'état du champ.
 */
export function chiffresLocauxSaisis(saisie: string): string {
  const d = chiffres(saisie);
  return d.startsWith(PREFIXE_TELEPHONE) ? d.slice(PREFIXE_TELEPHONE.length) : d;
}

/**
 * Affiche un numéro stocké sous la forme "+229 01 97 00 00 00".
 * Fonctionne que le numéro stocké contienne ou non le préfixe.
 */
export function formaterTelephoneAffichage(phone: string): string {
  const d = chiffres(phone);
  const local = d.startsWith(PREFIXE_TELEPHONE) ? d.slice(PREFIXE_TELEPHONE.length) : d;
  // Groupe les chiffres locaux par 2 : "0197000000" → "01 97 00 00 00"
  const local10 = (local + "0".repeat(LONGUEUR_TELEPHONE_LOCAL)).slice(0, LONGUEUR_TELEPHONE_LOCAL);
  const groupes = local10.match(/.{1,2}/g) ?? [];
  return `+${PREFIXE_TELEPHONE} ${groupes.join(" ")}`;
}
