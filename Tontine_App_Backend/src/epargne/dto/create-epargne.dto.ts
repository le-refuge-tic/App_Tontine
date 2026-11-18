import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { StatutEpargne } from '../../common/enums';

export class CreateEpargneDto {
  @ApiProperty({ description: 'Membre propriétaire de l\u2019épargne.' })
  @IsInt()
  membreId!: number;

  @ApiPropertyOptional({ example: 0, description: 'Montant épargné (FCFA).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  montant?: number;

  @ApiProperty({ example: '2026-06-30', description: "Date d'échéance (AAAA-MM-JJ)." })
  @IsDateString()
  dateEcheance!: string;

  @ApiPropertyOptional({ enum: StatutEpargne, description: 'Statut (actif par défaut).' })
  @IsOptional()
  @IsEnum(StatutEpargne)
  statut?: StatutEpargne;
}
