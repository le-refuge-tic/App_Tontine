import { couleurs, type Couleurs } from "./couleurs";
import { typographie, type Typographie } from "./typographie";
import { espacements, type Espacements } from "./espacements";
import { rayons, type Rayons } from "./rayons";
import { ombres, type Ombres } from "./ombres";

export interface Theme {
  couleurs: Couleurs;
  typographie: Typographie;
  espacements: Espacements;
  rayons: Rayons;
  ombres: Ombres;
}

/** Thème clair (seul thème pour l'instant). TODO(sombre) : ajouter themeSombre. */
export const themeClair: Theme = {
  couleurs,
  typographie,
  espacements,
  rayons,
  ombres,
};

export const theme = themeClair;

export { couleurs, typographie, espacements, rayons, ombres };
export type { Couleurs, Typographie, Espacements, Rayons, Ombres };
