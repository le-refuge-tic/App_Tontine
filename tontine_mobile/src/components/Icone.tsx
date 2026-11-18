import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { couleurs } from "@/theme";

/**
 * Enveloppe unique autour d'Ionicons (style "outline" privilégié côté écrans).
 * Changer de famille d'icônes plus tard se fera ici uniquement.
 */
export type NomIcone = ComponentProps<typeof Ionicons>["name"];

interface Props {
  nom: NomIcone;
  taille?: number;
  couleur?: string;
  style?: ComponentProps<typeof Ionicons>["style"];
}

export function Icone({ nom, taille = 24, couleur = couleurs.texteSecondaire, style }: Props) {
  return <Ionicons name={nom} size={taille} color={couleur} style={style} />;
}
