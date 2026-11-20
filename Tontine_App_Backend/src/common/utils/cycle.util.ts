import { Cycle } from '../../cycle/entities/cycle.entity';
import { JourCotisation } from '../../jour-cotisation/entities/jour-cotisation.entity';
import { Souscription } from '../../souscription/entities/souscription.entity';
import { Regularite, StatutCycle, StatutJourCotisation } from '../enums';
import { decomposerISO, formatISO, nbJoursCycle } from './dates.util';

/** Règle d'or : la somme des coefficients d'un cycle vaut toujours 31. */
export const TOTAL_JOURS_CYCLE = 31;

/**
 * Répartit les coefficients d'un cycle pour que leur somme vaille toujours 31.
 *
 * @param nbJoursDuMois nombre de lignes (jours) du cycle (1 à 31).
 * @param premierJour   jour-du-mois de la première ligne (réservé pour un futur
 *                      choix des jours doublés ; ignoré par le comportement
 *                      PROVISOIRE ci-dessous).
 * @returns un tableau de `nbJoursDuMois` coefficients, du premier au dernier
 *          jour du cycle.
 *
 * TODO(decision) : choix des jours doublés/triplés. Comportement PROVISOIRE :
 * les jours « en plus » (coefficient 2, puis 3 si besoin) sont concentrés sur
 * les DERNIERS jours du cycle. Les alternatives sont : jours choisis par le
 * membre, ou jours fixés par le système. Le paramètre `premierJour` est
 * conservé pour ces évolutions.
 */
export function repartirCoefficients(
  nbJoursDuMois: number,
  premierJour: number,
): number[] {
  const n = Math.max(1, Math.floor(nbJoursDuMois));
  // `premierJour` est volontairement inutilisé pour l'instant (voir TODO ci-dessus).
  void premierJour;

  const coeffs = new Array<number>(n).fill(1);
  let deficit = TOTAL_JOURS_CYCLE - n;

  // On remplit depuis le dernier jour, en reculant. Plusieurs passes
  // successives donnent d'abord des coefficients 2, puis 3, puis 4…
  let i = n - 1;
  while (deficit > 0) {
    coeffs[i] += 1;
    deficit -= 1;
    i = (i - 1 + n) % n;
  }
  return coeffs;
}

/** Jour de cotisation « aplati » pour `calculerProchaineEcheance`. */
export interface JourEcheance {
  datePrevue: string;
  statut: StatutJourCotisation;
  montantDu: number;
}

/** Résultat du calcul de la prochaine échéance. */
export interface ProchaineEcheance {
  date: string;
  montant: number;
}

/**
 * Calcule la prochaine échéance de paiement d'un cycle.
 *
 * TODO(decision) : répartition des 3 jours en plus du mois de 31 jours pour
 * l'hebdomadaire. Comportement PROVISOIRE, identique quelle que soit la
 * régularité : la prochaine échéance est le premier jour « à payer » dont la
 * date prévue est aujourd'hui ou plus tard ; à défaut, le premier jour « à
 * payer » du cycle (jour échu en retard). La régularité sert uniquement à
 * calculer cette échéance et le montant à payer.
 */
export function calculerProchaineEcheance(
  jours: JourEcheance[],
  _regularite: Regularite,
  aujourdhui: string,
): ProchaineEcheance | null {
  const aPayer = jours.filter((j) => j.statut === StatutJourCotisation.A_PAYER);
  if (aPayer.length === 0) return null;

  const futurs = aPayer.filter((j) => j.datePrevue >= aujourdhui);
  const candidats = futurs.length > 0 ? futurs : aPayer;
  candidats.sort((a, b) => a.datePrevue.localeCompare(b.datePrevue));
  const choisi = candidats[0];
  return { date: choisi.datePrevue, montant: choisi.montantDu };
}

/** Paramètres de construction d'un cycle (toutes valeurs figées). */
export interface ParametresCycle {
  souscription: Souscription;
  numero: number;
  dateDebut: string;
  dateFin: string;
  miseBase: number;
  regularite: Regularite;
}

/**
 * Construit, sans persister, une entité `Cycle` et ses `JourCotisation`.
 *
 * Fonction pure : deterministic à partir des paramètres. Le cycle créé a
 * `statut = en_cours` et `fondsCaisseRetenu = miseBase` (plafond de retenue
 * prévu pour ce cycle ; aucune écriture de fonds de caisse n'est créée ici).
 *
 * TODO(decision) : fonds de caisse d'un NOUVEAU cycle — retenu à l'ouverture
 * ou au premier dépôt du cycle. Ici on NE CRÉE PAS l'écriture de fonds de
 * caisse : cela sera fait au prompt « Dépôts ». La valeur `fondsCaisseRetenu`
 * ci-dessous est le plafond prévu, pas un montant réellement retenu.
 */
export function construireCycle(params: ParametresCycle): Cycle {
  const { souscription, numero, dateDebut, dateFin, miseBase, regularite } =
    params;
  const { annee, mois, jour: premierJour } = decomposerISO(dateDebut);
  const nb = nbJoursCycle(dateDebut, dateFin);
  const coeffs = repartirCoefficients(nb, premierJour);

  const jours: JourCotisation[] = [];
  for (let i = 0; i < nb; i++) {
    const jour = new JourCotisation();
    jour.numeroJour = premierJour + i;
    jour.datePrevue = formatISO(annee, mois, premierJour + i);
    jour.coefficient = coeffs[i];
    jour.montantDu = miseBase * coeffs[i];
    jour.montantPaye = 0;
    jour.statut = StatutJourCotisation.A_PAYER;
    jours.push(jour);
  }

  const cycle = new Cycle();
  cycle.numero = numero;
  cycle.miseBase = miseBase;
  cycle.regularite = regularite;
  cycle.dateDebut = dateDebut;
  cycle.dateFin = dateFin;
  cycle.fondsCaisseRetenu = miseBase;
  cycle.statut = StatutCycle.EN_COURS;
  cycle.souscription = souscription;
  cycle.jourCotisations = jours;
  return cycle;
}
