import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { Regularite } from '../../common/enums';

export class CreateSouscriptionDto {
  @ApiProperty({ description: 'Identifiant du membre souscripteur.' })
  @IsInt()
  membreId!: number;

  @ApiProperty({
    example: 5000,
    description: "Mise de base (FCFA), supérieure ou égale à `mise_minimale`.",
  })
  @IsInt()
  @Min(0)
  miseBase!: number;

  @ApiProperty({ enum: Regularite, example: Regularite.MOIS, description: 'Régularité de cotisation.' })
  @IsEnum(Regularite)
  regularite!: Regularite;

  @ApiProperty({ example: '2026-01-01', description: 'Date de démarrage (AAAA-MM-JJ).' })
  @IsDateString()
  dateDemarrage!: string;
}
