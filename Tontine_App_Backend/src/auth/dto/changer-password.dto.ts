import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MinLength } from 'class-validator';

/** Corps de la requête POST /auth/changer-password. */
export class ChangerPasswordDto {
  @ApiProperty({ description: 'Mot de passe actuel.' })
  @IsString()
  ancienPassword!: string;

  @ApiProperty({
    description: 'Nouveau mot de passe (min 8 caractères, au moins une lettre et un chiffre).',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: 'Le nouveau mot de passe doit contenir au moins une lettre et un chiffre.',
  })
  nouveauPassword!: string;
}
