import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { Regularite } from '../../common/enums';

export class CreateCycleDto {
  @ApiProperty({ description: 'Souscription rattachée au cycle.' })
  @IsInt()
  souscriptionId!: number;

  @ApiProperty({ example: 1, description: 'Numéro du cycle (unique par souscription).' })
  @IsInt()
  @Min(1)
  numero!: number;

  @ApiProperty({ example: 5000, description: 'Mise de base figée à l\u2019ouverture (FCFA).' })
  @IsInt()
  @Min(0)
  miseBase!: number;

  @ApiProperty({ enum: Regularite, description: 'Régularité figée à l\u2019ouverture.' })
  @IsEnum(Regularite)
  regularite!: Regularite;

  @ApiProperty({ example: '2026-01-01', description: 'Date de début du cycle (AAAA-MM-JJ).' })
  @IsDateString()
  dateDebut!: string;

  @ApiProperty({ example: '2026-01-31', description: 'Date de fin du cycle (AAAA-MM-JJ).' })
  @IsDateString()
  dateFin!: string;

  @ApiProperty({ example: 5000, description: 'Fonds de caisse retenu (FCFA).' })
  @IsInt()
  @Min(0)
  fondsCaisseRetenu!: number;
}
