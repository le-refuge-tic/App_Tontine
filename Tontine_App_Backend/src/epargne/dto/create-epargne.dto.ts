import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

/**
 * Corps de `POST /epargnes` : crée une épargne (statut actif, montant 0) et
 * initie le dépôt initial FedaPay en un seul geste.
 *
 * Le membre est déduit du jeton JWT côté serveur (ne pas envoyer `membreId`).
 *
 * Depuis le prompt 7b :
 * - `dateEcheance` n'est plus demandée. Elle est ignorée silencieusement si
 *   elle est envoyée (rétrocompatibilité client), mais n'est pas stockée.
 * - `objectifMontant` est OBLIGATOIRE (entier ≥ 1). Chaque membre fixe son
 *   propre objectif ; il n'y a pas de minimum imposé par l'application autre
 *   que ≥ 1.
 */
export class CreateEpargneDto {
  @ApiProperty({
    example: 5000,
    description:
      'Montant initial à épargner (FCFA, entier ≥ epargne_minimale).',
  })
  @IsInt()
  @Min(1)
  montantInitial!: number;

  /**
   * @deprecated Ignorée silencieusement depuis le prompt 7b. La date
   * d'échéance n'existe plus.
   */
  @ApiPropertyOptional({
    example: '2026-06-30',
    description:
      "Ignorée (plus de date d'échéance). Acceptée sans erreur pour la compatibilité client.",
  })
  @IsOptional()
  @IsDateString()
  dateEcheance?: string;

  /**
   * Nom du projet d'épargne. Obligatoire à la création, entre 2 et 100
   * caractères. Modifiable ensuite via PATCH /epargnes/:id tant qu'aucun
   * dépôt n'a réussi.
   */
  @ApiProperty({
    example: 'Achat moto',
    description:
      'Nom du projet d\'épargne (2 à 100 caractères). Défaut : "Mon projet".',
    minLength: 2,
    maxLength: 100,
  })
  @IsString()
  @Length(2, 100)
  nom!: string;

  /**
   * Montant cible (FCFA, entier ≥ 1). OBLIGATOIRE.
   * Chaque membre fixe son propre objectif ; il n'y a pas de minimum imposé.
   * Pas de maximum. L'objectif détermine le taux au retrait (2,75 % si
   * atteint, 5 % sinon).
   */
  @ApiProperty({
    example: 50000,
    description:
      'Montant objectif (FCFA, entier ≥ 1). Obligatoire. Détermine le taux de retrait.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  objectifMontant!: number;
}
