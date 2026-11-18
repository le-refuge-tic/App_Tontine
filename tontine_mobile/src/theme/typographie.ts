import type { TextStyle } from "react-native";

// Famille de police unique : Plus Jakarta Sans. Chaque graisse est chargée comme
// sa propre "famille" par @expo-google-fonts (ex. PlusJakartaSans_800ExtraBold).
// On référence donc directement le nom de graisse, sans s'appuyer sur fontWeight.

export const familles = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semiBold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extraBold: "PlusJakartaSans_800ExtraBold",
} as const;

export const police = "PlusJakartaSans";

/** Échelle typographique définie une seule fois. Montants en ExtraBold (800). */
export const typographie = {
  police,
  familles,

  // Montants (ExtraBold).
  heroMontant: { fontFamily: familles.extraBold, fontSize: 40, lineHeight: 46 } satisfies TextStyle,
  montantGrand: { fontFamily: familles.extraBold, fontSize: 30, lineHeight: 36 } satisfies TextStyle,
  montantMoyen: { fontFamily: familles.extraBold, fontSize: 22, lineHeight: 26 } satisfies TextStyle,
  montantPetit: { fontFamily: familles.extraBold, fontSize: 16, lineHeight: 20 } satisfies TextStyle,

  // Titres.
  titre: { fontFamily: familles.bold, fontSize: 22, lineHeight: 28 } satisfies TextStyle,
  titre2: { fontFamily: familles.bold, fontSize: 18, lineHeight: 24 } satisfies TextStyle,
  titre3: { fontFamily: familles.bold, fontSize: 16, lineHeight: 22 } satisfies TextStyle,

  // Corps.
  corps: { fontFamily: familles.regular, fontSize: 16, lineHeight: 22 } satisfies TextStyle,
  corpsMedium: { fontFamily: familles.medium, fontSize: 16, lineHeight: 22 } satisfies TextStyle,
  corps2: { fontFamily: familles.regular, fontSize: 14, lineHeight: 20 } satisfies TextStyle,
  corps2Medium: { fontFamily: familles.medium, fontSize: 14, lineHeight: 20 } satisfies TextStyle,

  // Petits libellés.
  legende: { fontFamily: familles.medium, fontSize: 12, lineHeight: 16 } satisfies TextStyle,
  legende2: { fontFamily: familles.medium, fontSize: 11, lineHeight: 15 } satisfies TextStyle,
  badge: { fontFamily: familles.extraBold, fontSize: 11, lineHeight: 15 } satisfies TextStyle,

  // Bouton principal.
  bouton: { fontFamily: familles.bold, fontSize: 16, lineHeight: 22 } satisfies TextStyle,
} as const;

export type Typographie = typeof typographie;
