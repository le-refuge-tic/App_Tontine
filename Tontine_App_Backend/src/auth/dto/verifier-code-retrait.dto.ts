import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

/** Corps de la requête POST /auth/code-retrait/verifier. */
export class VerifierCodeRetraitDto {
  @ApiProperty({
    example: '1234',
    description: 'Code de retrait à vérifier (4 à 6 chiffres).',
  })
  @IsString()
  @Matches(/^\d{4,6}$/, {
    message: 'Le code de retrait doit comporter 4 à 6 chiffres.',
  })
  codeRetrait!: string;
}
