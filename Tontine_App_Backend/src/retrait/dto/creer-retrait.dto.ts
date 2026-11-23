import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreerRetraitDto {
  @ApiPropertyOptional({
    description: 'Montant à retirer (FCFA). Exclusif avec total.',
  })
  @ValidateIf((o: CreerRetraitDto) => !o.total)
  @IsInt()
  @IsPositive()
  montant?: number;

  @ApiPropertyOptional({
    description: 'Retrait total du solde disponible. Exclusif avec montant.',
  })
  @ValidateIf((o: CreerRetraitDto) => !o.montant)
  @IsBoolean()
  @IsOptional()
  total?: boolean;

  @ApiProperty({
    description:
      'Jeton de retrait JWT (audience tontine-retrait, durée 5 min).',
  })
  @IsString()
  jetonRetrait!: string;
}
