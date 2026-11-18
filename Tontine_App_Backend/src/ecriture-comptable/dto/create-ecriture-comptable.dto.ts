import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { SensEcriture, TypeEcriture } from '../../common/enums';

/**
 * DTO de création d'une écriture comptable (grand livre, immuable). Usage
 * interne uniquement : `EcritureComptableService.enregistrer`.
 */
export class CreateEcritureComptableDto {
  @ApiProperty({ enum: TypeEcriture, description: "Type de l'écriture." })
  @IsEnum(TypeEcriture)
  type!: TypeEcriture;

  @ApiProperty({ example: 5000, description: 'Montant (FCFA, strictement positif).' })
  @IsInt()
  @Min(1)
  montant!: number;

  @ApiProperty({ enum: SensEcriture, description: "Sens de l'écriture (credit / debit)." })
  @IsEnum(SensEcriture)
  sens!: SensEcriture;

  @ApiProperty({ description: 'Description de l\u2019écriture.' })
  @IsString()
  description!: string;

  @ApiProperty({ description: 'Membre concerné (obligatoire).' })
  @IsInt()
  membreId!: number;

  @ApiPropertyOptional({ description: 'Transaction liée (nullable).' })
  @IsOptional()
  @IsInt()
  transactionId?: number;

  @ApiPropertyOptional({ description: 'Cycle lié (nullable) ; ne peut pas coexister avec un prêt.' })
  @IsOptional()
  @IsInt()
  cycleId?: number;

  @ApiPropertyOptional({ description: 'Prêt lié (nullable) ; ne peut pas coexister avec un cycle.' })
  @IsOptional()
  @IsInt()
  pretId?: number;

  @ApiPropertyOptional({ description: 'Remboursement lié (nullable).' })
  @IsOptional()
  @IsInt()
  remboursementId?: number;
}
