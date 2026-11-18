/**
 * Statut d'une garantie (témoignage) d'un prêt.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 */
export enum StatutGarantie {
  EN_ATTENTE = 'en_attente',
  ACCEPTEE = 'acceptee',
  REFUSEE = 'refusee',
  LIBEREE = 'liberee',
  PRELEVEE = 'prelevee',
}
