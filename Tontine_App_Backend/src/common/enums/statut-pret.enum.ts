/**
 * Statut d'un prêt.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 */
export enum StatutPret {
  DEMANDE = 'demande',
  GARANTIES_EN_ATTENTE = 'garanties_en_attente',
  ACCORDE = 'accorde',
  REMBOURSE = 'rembourse',
  IMPAYE = 'impaye',
  ANNULE = 'annule',
}
