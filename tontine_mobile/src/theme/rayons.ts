// Échelle des rayons d'arrondi.

export const rayons = {
  /** Cartes principales. */
  carte: 24,
  /** Boutons. */
  bouton: 16,
  /** Contrôles segmentés et pastilles (pilule). */
  pilule: 999,
  /** Cases du carnet du mois. */
  case: 16,
  /** Champs de saisie. */
  champ: 14,
  /** Feuille basse (bottom sheet). */
  feuille: 28,
  /** Petites pastilles d'icône. */
  pastille: 12,
} as const;

export type Rayons = typeof rayons;
