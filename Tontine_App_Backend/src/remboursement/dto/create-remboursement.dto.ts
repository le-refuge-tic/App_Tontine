import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

export class CreateRemboursementDto {
  @ApiProperty({ description: 'Prêt remboursé.' })
  @IsInt()
  pretId!: number;

  @ApiProperty({ example: 5000, description: 'Montant remboursé (FCFA).' })
  @IsInt()
  @Min(0)
  montant!: number;

  @ApiProperty({ example: '2026-02-15', description: 'Date du remboursement (AAAA-MM-JJ).' })
  @IsDateString()
  date!: string;
}
