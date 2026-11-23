import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsInt, Min } from 'class-validator';

/**
 * Corps de `POST /epargnes` : crée une épargne (statut actif, montant 0) et
 * initie le dépôt initial FedaPay en un seul geste.
 *
 * Le membre est déduit du jeton JWT côté serveur (ne pas envoyer `membreId`).
 * La date d'échéance doit être strictement dans le futur (vérifié côté service,
 * fuseau Africa/Porto-Novo).
 */
export class CreateEpargneDto {
  @ApiProperty({
    example: 5000,
    description: 'Montant initial à épargner (FCFA, entier ≥ epargne_minimale).',
  })
  @IsInt()
  @Min(1)
  montantInitial!: number;

  @ApiProperty({
    example: '2026-06-30',
    description: "Date d'échéance (AAAA-MM-JJ), obligatoirement dans le futur.",
  })
  @IsDateString()
  dateEcheance!: string;
}
