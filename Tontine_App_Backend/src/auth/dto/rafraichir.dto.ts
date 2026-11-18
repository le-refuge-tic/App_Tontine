import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Corps de la requête POST /auth/rafraichir. */
export class RafraichirDto {
  @ApiProperty({ description: 'Jeton de rafraîchissement actif.' })
  @IsString()
  refreshToken!: string;
}
