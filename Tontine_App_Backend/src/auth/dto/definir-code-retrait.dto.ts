import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Corps de la requête POST /auth/code-retrait (définir ou changer). */
export class DefinirCodeRetraitDto {
  @ApiProperty({ description: 'Mot de passe actuel (confirmation d\'identité).' })
  @IsString()
  password!: string;

  @ApiProperty({
    example: '1234',
    description: 'Code de retrait (4 à 6 chiffres).',
  })
  @IsString()
  @Matches(/^\d{4,6}$/, {
    message: 'Le code de retrait doit comporter 4 à 6 chiffres.',
  })
  codeRetrait!: string;
}
