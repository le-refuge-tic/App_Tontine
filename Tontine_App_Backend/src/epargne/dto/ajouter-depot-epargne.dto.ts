import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

/**
 * Corps de `POST /epargnes/:id/depots` : ajoute de l'argent à une épargne
 * active via un dépôt FedaPay.
 */
export class AjouterDepotEpargneDto {
  @ApiProperty({
    example: 2000,
    description: 'Montant à ajouter (FCFA, entier ≥ epargne_minimale).',
  })
  @IsInt()
  @Min(1)
  montant!: number;
}
