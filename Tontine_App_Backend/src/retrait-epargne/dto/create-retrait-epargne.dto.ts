import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsPositive,
  ValidateIf,
} from 'class-validator';

/**
 * Corps de `POST /epargnes/:id/retraits` : initie un retrait d'épargne vers
 * Mobile Money. Même sécurité que les retraits de cotisation : `montant` XOR
 * `total`, et un jeton de retrait à usage unique (vérifié et consommé dans la
 * même transaction DB que la création).
 */
export class CreateRetraitEpargneDto {
  @ApiPropertyOptional({
    description: 'Montant à retirer (FCFA). Exclusif avec `total`.',
  })
  @ValidateIf((o: CreateRetraitEpargneDto) => !o.total)
  @IsInt()
  @IsPositive()
  montant?: number;

  @ApiPropertyOptional({
    description: 'Retrait total du solde de cette épargne. Exclusif avec `montant`.',
  })
  @ValidateIf((o: CreateRetraitEpargneDto) => !o.montant)
  @IsBoolean()
  @IsOptional()
  total?: boolean;

  @ApiProperty({
    description:
      'Jeton de retrait JWT (audience tontine-retrait, durée 5 min, usage unique).',
  })
  @IsString()
  jetonRetrait!: string;
}
