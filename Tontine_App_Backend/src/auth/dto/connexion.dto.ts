import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Corps de la requête POST /auth/connexion. */
export class ConnexionDto {
  @ApiProperty({
    example: '0197000000',
    description: 'Numéro béninois : 10 chiffres locaux (0197000000) ou 13 avec préfixe (2290197000000).',
  })
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
