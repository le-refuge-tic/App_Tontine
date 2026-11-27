import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Length, Min } from 'class-validator';

/**
 * Corps de `PATCH /epargnes/:id` : permet au membre propriétaire de modifier
 * le nom et/ou l'objectif de montant d'une épargne ACTIVE uniquement.
 *
 * Depuis le prompt 7b :
 * - `objectifMontant` n'est plus nullable (l'épargne requiert toujours un
 *   objectif). Pour changer la valeur, envoyer un entier ≥ 1.
 * - La modification de l'objectif est bloquée (409) dès qu'un dépôt a réussi
 *   (montant > 0 ou objectifAtteintLe non null).
 * - Le nom reste modifiable à tout moment (épargne active).
 *
 * Aucun champ d'argent (montant, montantInitial, dateEcheance) n'est
 * modifiable. Renvoie 404 si l'épargne n'appartient pas au membre,
 * 409 si elle n'est pas active ou si un dépôt a déjà réussi (pour l'objectif).
 *
 * TODO(decision) : autoriser une hausse de l'objectif après dépôt ?
 */
export class UpdateEpargneDto {
  /**
   * Nouveau nom du projet. Entre 2 et 100 caractères. Toujours modifiable
   * tant que l'épargne est active.
   */
  @ApiPropertyOptional({
    example: 'Achat terrain',
    description:
      "Nouveau nom du projet d'épargne (2 à 100 caractères). Optionnel.",
    minLength: 2,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nom?: string;

  /**
   * Nouvel objectif de montant (FCFA, entier ≥ 1). Modifiable uniquement
   * avant tout dépôt réussi. Renvoie 409 si un dépôt a déjà été confirmé.
   */
  @ApiPropertyOptional({
    example: 100000,
    description:
      'Nouvel objectif de montant (FCFA, entier ≥ 1). Bloqué après le premier dépôt réussi.',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  objectifMontant?: number;
}
