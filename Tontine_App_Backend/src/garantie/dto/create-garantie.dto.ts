import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { StatutGarantie } from '../../common/enums';

export class CreateGarantieDto {
  @ApiProperty({ description: 'Prêt garanti.' })
  @IsInt()
  pretId!: number;

  @ApiProperty({ description: 'Membre témoin.' })
  @IsInt()
  temoinId!: number;

  @ApiProperty({ example: 10000, description: 'Montant du gage (FCFA).' })
  @IsInt()
  @Min(0)
  montantGage!: number;

  @ApiPropertyOptional({ enum: StatutGarantie, description: 'Statut (en_attente par défaut).' })
  @IsOptional()
  @IsEnum(StatutGarantie)
  statut?: StatutGarantie;
}
