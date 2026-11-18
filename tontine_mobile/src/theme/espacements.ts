// Échelle des espacements.

export const espacements = {
  e2: 2,
  e4: 4,
  e8: 8,
  e12: 12,
  e16: 16,
  e20: 20,
  e24: 24,
  e32: 32,
  e40: 40,
  e48: 48,
  e64: 64,

  /** Padding horizontal des écrans. */
  contenu: 20,
  /** Espace vertical entre blocs. */
  interBloc: 16,
  /** Espace vertical entre cartes rapprochées. */
  interCarte: 12,
  /** Espace vertical entre champs d'un formulaire. */
  interChamp: 14,
} as const;

export type Espacements = typeof espacements;
