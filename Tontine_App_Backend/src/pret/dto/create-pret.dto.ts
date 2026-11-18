import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreatePretDto {
  @ApiProperty({ description: 'Membre emprunteur.' })
  @IsInt()
  emprunteurId!: number;

  @ApiProperty({ example: 40000, description: 'Montant total du prêt (FCFA).' })
  @IsInt()
  @Min(0)
  montantTotal!: number;

  @ApiProperty({ example: 10000, description: "Part de l'emprunteur (FCFA)." })
  @IsInt()
  @Min(0)
  partEmprunteur!: number;

  @ApiProperty({ example: 30000, description: 'Montant à rembourser (FCFA).' })
  @IsInt()
  @Min(0)
  montantARembourser!: number;

  @ApiPropertyOptional({ example: null, description: "Taux d'intérêt (numeric 5,2) ; non encore décidé." })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tauxInteret?: number | null;

  @ApiProperty({ example: '2026-01-15', description: 'Date de demande (AAAA-MM-JJ).' })
  @IsDateString()
  dateDemande!: string;

  @ApiPropertyOptional({ example: '2026-01-20', description: "Date d'octroi (AAAA-MM-JJ), nullable." })
  @IsOptional()
  @IsDateString()
  dateOctroi?: string;
}
