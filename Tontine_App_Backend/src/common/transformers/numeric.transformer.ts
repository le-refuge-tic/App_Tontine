import { ValueTransformer } from 'typeorm';

/**
 * Transformeur pour les colonnes `numeric(5,2)` (taux d'intérêt, taux appliqué).
 *
 * PostgreSQL renvoie les colonnes `numeric`/`decimal` sous forme de chaîne afin
 * de préserver la précision. Ce transformeur convertit cette chaîne en `number`
 * à la lecture et renvoie le nombre tel quel à l'écriture. Les valeurs `null`
 * (taux non encore décidé) sont préservées.
 */
export const NumericTransformer: ValueTransformer = {
  to(value: number | null): number | null {
    return value;
  },
  from(value: string | null): number | null {
    return value === null || value === undefined ? null : Number(value);
  },
};
