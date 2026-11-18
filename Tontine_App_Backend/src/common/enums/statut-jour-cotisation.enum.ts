/**
 * Statut d'un jour de cotisation.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 */
export enum StatutJourCotisation {
  A_PAYER = 'a_payer',
  PAYE = 'paye',
  PERDU = 'perdu',
  RATTRAPE = 'rattrape',
}
