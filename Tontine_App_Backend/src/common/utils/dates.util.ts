/**
 * Utilitaires de date pour le fuseau du Bénin (UTC+1, sans heure d'été).
 *
 * Toutes les dates de cotisation sont manipulées en `YYYY-MM-DD` (chaînes,
 * colonnes SQL `date`). Aucun objet `Date` porteur de fuseau n'est exposé : on
 * calcule l'instant courant en UTC, on ajoute 1 heure (décalage Bénin), puis on
 * lit les composants en UTC. Le résultat est insensible au fuseau du serveur.
 */

/** Décalage horaire du Bénin par rapport à UTC, en minutes (UTC+1). */
export const DECALAGE_BENIN_MINUTES = 60;

/** Composants date (mois 0-indexé, convention JS). */
export interface ComposantsDate {
  annee: number;
  mois: number;
  jour: number;
}

/** Date du jour au Bénin, au format `YYYY-MM-DD`. */
export function dateBeninISO(instant: Date = new Date()): string {
  const benin = new Date(instant.getTime() + DECALAGE_BENIN_MINUTES * 60_000);
  return benin.toISOString().slice(0, 10);
}

/** Composants (année, mois 0-indexé, jour) de la date du jour au Bénin. */
export function aujourdhuiBenin(instant: Date = new Date()): ComposantsDate {
  return decomposerISO(dateBeninISO(instant));
}

/**
 * Décompose une chaîne `YYYY-MM-DD` en composants. Le mois est 0-indexé
 * (janvier = 0), conformément à la convention JS utilisée partout ici.
 */
export function decomposerISO(iso: string): ComposantsDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) {
    throw new Error(`Date ISO invalide (attendu YYYY-MM-JJ) : « ${iso} ».`);
  }
  return {
    annee: Number(match[1]),
    mois: Number(match[2]) - 1,
    jour: Number(match[3]),
  };
}

/** Formate des composants (mois 0-indexé) en `YYYY-MM-DD`. */
export function formatISO(annee: number, mois: number, jour: number): string {
  const mm = String(mois + 1).padStart(2, '0');
  const jj = String(jour).padStart(2, '0');
  return `${annee}-${mm}-${jj}`;
}

/** Nombre de jours d'un mois calendaire (mois 0-indexé). Gère les bissextiles. */
export function nombreJoursMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
}

/** Dernier jour du mois calendaire, au format `YYYY-MM-DD`. */
export function dernierJourMoisISO(annee: number, mois: number): string {
  return formatISO(annee, mois, nombreJoursMois(annee, mois));
}

/** Premier jour du mois calendaire, au format `YYYY-MM-DD`. */
export function premierJourMoisISO(annee: number, mois: number): string {
  return formatISO(annee, mois, 1);
}

/** Mois calendaire suivant (mois 0-indexé). */
export function moisSuivant(annee: number, mois: number): ComposantsDate {
  return mois === 11
    ? { annee: annee + 1, mois: 0, jour: 1 }
    : { annee, mois: mois + 1, jour: 1 };
}

/**
 * Nombre de jours couverts par un cycle, `dateFin` incluse. Les deux dates
 * appartiennent obligatoirement au même mois calendaire : le résultat est donc
 * `jour(dateFin) − jour(dateDebut) + 1`.
 */
export function nbJoursCycle(dateDebut: string, dateFin: string): number {
  const debut = decomposerISO(dateDebut);
  const fin = decomposerISO(dateFin);
  if (debut.annee !== fin.annee || debut.mois !== fin.mois) {
    throw new Error(
      `Un cycle doit tenir dans un seul mois calendaire (début ${dateDebut}, fin ${dateFin}).`,
    );
  }
  return fin.jour - debut.jour + 1;
}
