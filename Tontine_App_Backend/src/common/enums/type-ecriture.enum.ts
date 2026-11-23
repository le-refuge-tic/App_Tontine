/**
 * Type d'une écriture comptable dans le grand livre.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 * Liste extensible : ajouter toute nouvelle valeur côté TS et via une migration
 * `ALTER TYPE ... ADD VALUE` côté base de données.
 */
export enum TypeEcriture {
  COTISATION = 'cotisation',
  FONDS_CAISSE = 'fonds_caisse',
  RETRAIT = 'retrait',
  EPARGNE = 'epargne',
  RETRAIT_EPARGNE = 'retrait_epargne',
  PENALITE = 'penalite',
  RETENUE_EPARGNE = 'retenue_epargne',
  INTERET = 'interet',
  GAGE_BLOQUE = 'gage_bloque',
  GAGE_LIBERE = 'gage_libere',
  GAGE_PRELEVE = 'gage_preleve',
  PRET_OCTROYE = 'pret_octroye',
  REMBOURSEMENT = 'remboursement',
  /**
   * Libération des fonds de caisse retenus lors d'un retrait total.
   * Écriture débit sur soldeCotisation pour annuler le résidu non retirable
   * (fondsCaisseRetenu + soldeBloque). Aucune ligne dans CaisseApplication :
   * les fonds y sont déjà acquis à l'application.
   */
  LIBERATION_FONDS = 'liberation_fonds',
}
