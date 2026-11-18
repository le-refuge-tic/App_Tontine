/**
 * Sens d'une écriture comptable.
 * - CREDIT : l'argent entre dans le compte du membre.
 * - DEBIT  : l'argent sort du compte du membre.
 * Stocké en base sous forme de chaîne en minuscules.
 */
export enum SensEcriture {
  CREDIT = 'credit',
  DEBIT = 'debit',
}
