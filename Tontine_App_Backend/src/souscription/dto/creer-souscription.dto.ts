import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, Min } from 'class-validator';
import { Regularite } from '../../common/enums';

/**
 * Corps de `POST /souscriptions` (membre connecté). La date de démarrage et
 * le membre sont fixés côté serveur : seul le client fournit la mise et la
 * régularité.
 */
export class CreerSouscriptionDto {
  @ApiProperty({
    example: 500,
    description:
      'Mise de base (FCFA), supérieure ou égale à `mise_minimale` (200 par défaut).',
  })
  @IsInt()
  @Min(1)
  miseBase!: number;

  @ApiProperty({
    enum: Regularite,
    example: Regularite.JOUR,
    description: 'Régularité de cotisation.',
  })
  @IsEnum(Regularite)
  regularite!: Regularite;
}
