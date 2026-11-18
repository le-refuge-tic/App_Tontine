import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

/** Corps de la requête POST /auth/connexion. */
export class ConnexionDto {
  @ApiProperty({ example: '97000000' })
  @IsString()
  phone!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}
