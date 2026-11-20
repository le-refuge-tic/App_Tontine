import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { Regularite } from '../../common/enums';

/**
 * Corps de `POST /souscriptions/changement`. Au moins un des deux champs doit
 * être fourni (validé dans le service). Aucun effet sur le cycle en cours :
 * la nouvelle valeur s'applique à l'ouverture du cycle suivant.
 */
export class DemanderChangementDto {
  @ApiProperty({
    example: 1000,
    description:
      'Nouvelle mise de base (FCFA) souhaitée pour le cycle suivant.',
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  miseBase?: number;

  @ApiProperty({
    enum: Regularite,
    example: Regularite.SEMAINE,
    description: 'Nouvelle régularité souhaitée pour le cycle suivant.',
    required: false,
  })
  @IsOptional()
  @IsEnum(Regularite)
  regularite?: Regularite;
}
