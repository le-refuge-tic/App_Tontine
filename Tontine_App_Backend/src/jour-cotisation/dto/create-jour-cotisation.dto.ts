import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateJourCotisationDto {
  @ApiProperty({ description: 'Cycle rattaché au jour de cotisation.' })
  @IsInt()
  cycleId!: number;

  @ApiProperty({ example: 1, description: 'Rang du jour dans le mois (1 à 31).' })
  @IsInt()
  @Min(1)
  @Max(31)
  numeroJour!: number;

  @ApiProperty({ example: '2026-01-01', description: 'Date prévue (AAAA-MM-JJ).' })
  @IsDateString()
  datePrevue!: string;

  @ApiPropertyOptional({ example: 1, description: 'Coefficient du jour (la somme des coefficients d\u2019un cycle vaut 31).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  coefficient?: number;

  @ApiProperty({ example: 5000, description: 'Montant dû (FCFA).' })
  @IsInt()
  @Min(0)
  montantDu!: number;

  @ApiPropertyOptional({ example: 0, description: 'Montant payé (FCFA).' })
  @IsOptional()
  @IsInt()
  @Min(0)
  montantPaye?: number;
}
