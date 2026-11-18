import type { ViewStyle } from "react-native";

// Ombres très douces (jamais de bordure noire).

export const ombres = {
  carte: {
    shadowColor: "#14211B",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  } satisfies ViewStyle,

  carteElevee: {
    shadowColor: "#14211B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 6,
  } satisfies ViewStyle,

  bouton: {
    shadowColor: "#083D2E",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 3,
  } satisfies ViewStyle,

  onglets: {
    shadowColor: "#14211B",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 6,
  } satisfies ViewStyle,

  feuille: {
    shadowColor: "#14211B",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  } satisfies ViewStyle,
} as const;

export type Ombres = typeof ombres;
