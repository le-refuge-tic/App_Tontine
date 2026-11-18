/**
 * Source d'un encaissement dans la caisse d'application.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 */
export enum SourceCaisse {
  FONDS_CAISSE = 'fonds_caisse',
  PENALITE = 'penalite',
  RETENUE_EPARGNE = 'retenue_epargne',
  INTERET = 'interet',
}
