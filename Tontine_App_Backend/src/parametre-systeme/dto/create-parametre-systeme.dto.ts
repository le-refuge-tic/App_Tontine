import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateParametreSystemeDto {
  @ApiProperty({
    example: 'mise_minimale',
    description: 'Clé du paramètre (clé primaire).',
  })
  @IsString()
  @MaxLength(100)
  cle!: string;

  @ApiProperty({ example: '200', description: 'Valeur du paramètre (chaîne).' })
  @IsString()
  valeur!: string;

  @ApiPropertyOptional({
    example: 'Mise de base minimale (FCFA).',
    description: 'Description du paramètre.',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
