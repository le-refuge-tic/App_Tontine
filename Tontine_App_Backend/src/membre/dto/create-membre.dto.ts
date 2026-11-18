import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * DTO de création d'un membre (usage admin uniquement via le controller /membres).
 * L'inscription publique passe par POST /auth/inscription.
 * Le rôle et le statut ne sont jamais acceptés en entrée : fixés côté serveur.
 */
export class CreateMembreDto {
  @ApiProperty({ example: 'Alice Dupont', description: 'Nom complet du membre.' })
  @IsString()
  @MaxLength(100)
  nom!: string;

  @ApiProperty({ example: '97000000', description: 'Numéro de téléphone (unique).' })
  @IsString()
  @MaxLength(20)
  phone!: string;

  @ApiProperty({ description: 'Mot de passe (min 8 caractères, lettre + chiffre).' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
  })
  password!: string;

  @ApiPropertyOptional({ description: 'Code de retrait (4 à 6 chiffres).', example: '1234' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'Le code de retrait doit comporter 4 à 6 chiffres.' })
  codeRetrait?: string;
}
