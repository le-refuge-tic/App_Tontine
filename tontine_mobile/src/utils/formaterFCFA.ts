const SEP_MILLIERS = "\u202F"; // espace insécable fine entre les milliers
const ESPACE_F = "\u00A0"; // espace insécable avant le "F"

/**
 * Formate un montant entier en FCFA : "6 000 F".
 * La valeur absolue est utilisée (le signe est géré par l'appelant si besoin).
 */
export function formaterFCFA(montant: number): string {
  const n = Number.isFinite(montant) ? Math.trunc(Math.abs(montant)) : 0;
  const s = n.toString();
  const groupes: string[] = [];
  for (let i = s.length; i > 0; i -= 3) {
    groupes.unshift(s.slice(Math.max(0, i - 3), i));
  }
  return `${groupes.join(SEP_MILLIERS)}${ESPACE_F}F`;
}
