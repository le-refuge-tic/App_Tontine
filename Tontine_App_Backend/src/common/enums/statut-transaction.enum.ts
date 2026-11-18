/**
 * Statut d'une transaction.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 */
export enum StatutTransaction {
  EN_ATTENTE = 'en_attente',
  REUSSI = 'reussi',
  ECHOUE = 'echoue',
}
