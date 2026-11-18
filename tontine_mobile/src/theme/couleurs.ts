// Palette de l'application (mode clair uniquement pour l'instant,
// structurée pour ajouter un mode sombre plus tard).

export const couleurs = {
  /** Fond général de l'écran. */
  fond: "#FAF8F3",
  /** Surface des cartes. */
  surface: "#FFFFFF",
  /** Bordure très discrète. */
  bordure: "#ECE8DE",

  /** Texte principal. */
  textePrimaire: "#14211B",
  /** Texte secondaire. */
  texteSecondaire: "#66726B",

  /** Primaire : émeraude (actions, retirable). */
  primaire: "#0E7C5A",
  /** Primaire foncé (fonds de cartes héro, dégradés). */
  primaireFonce: "#083D2E",
  /** Primaire très clair (fonds doux, rattrapé). */
  primaireTresClair: "#E6F4EE",

  /** Or : accent, fonds de caisse retenu, éléments "retenus". */
  or: "#E9A93A",
  /** Or clair (fonds doux doré). */
  orClair: "#FBF1DA",

  /** Succès. */
  succes: "#1F9D6B",
  /** Avertissement. */
  avertissement: "#E8A33D",
  /** Danger. */
  danger: "#D64545",
  /** Gris "perdu" (jours non payés, éléments inactifs). */
  grisPerdu: "#B9BDB6",
} as const;

export type Couleurs = typeof couleurs;
