/**
 * Type d'une notification envoyée à un membre.
 * Stocké en base sous forme de chaîne en minuscules snake_case.
 * Liste extensible : ajouter toute nouvelle valeur côté TS et via une migration
 * `ALTER TYPE ... ADD VALUE` côté base de données.
 */
export enum TypeNotification {
  RAPPEL_PAIEMENT = 'rappel_paiement',
  RETRAIT_EFFECTUE = 'retrait_effectue',
}
