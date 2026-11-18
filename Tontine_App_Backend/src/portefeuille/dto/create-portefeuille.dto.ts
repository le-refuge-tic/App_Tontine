import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * DTO de création d'un portefeuille. Usage interne uniquement : la création
 * publique est interdite (le portefeuille est créé par `MembreService.create`).
 */
export class CreatePortefeuilleDto {
  @ApiProperty({ description: 'Membre propriétaire du portefeuille.' })
  @IsInt()
  membreId!: number;

  @ApiPropertyOptional({ example: 0, description: 'Solde de cotisation (FCFA).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  soldeCotisation?: number;

  @ApiPropertyOptional({ example: 0, description: 'Solde d\u2019épargne (FCFA).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  soldeEpargne?: number;

  @ApiPropertyOptional({ example: 0, description: 'Solde bloqué (FCFA).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  soldeBloque?: number;
}
