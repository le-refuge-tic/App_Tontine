import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

/**
 * Corps de la requête POST /auth/inscription.
 * Le rôle et le statut ne sont jamais acceptés en entrée : ils sont fixés
 * par le serveur (role = membre, statut = actif).
 */
export class InscriptionDto {
  @ApiProperty({ example: 'Alice Dupont', description: 'Nom complet du membre.' })
  @IsString()
  @MaxLength(100)
  nom!: string;

  @ApiProperty({
    example: '0197000000',
    description: 'Numéro béninois : 10 chiffres locaux (0197000000) ou 13 avec préfixe (2290197000000).',
  })
  @IsString()
  @Matches(/^[\d\s+\-]{8,20}$/, {
    message: 'Le numéro de téléphone doit contenir entre 8 et 15 chiffres.',
  })
  phone!: string;

  @ApiProperty({
    description: 'Mot de passe (min 8 caractères, au moins une lettre et un chiffre).',
  })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d).+$/, {
    message: 'Le mot de passe doit contenir au moins une lettre et un chiffre.',
  })
  password!: string;
}
