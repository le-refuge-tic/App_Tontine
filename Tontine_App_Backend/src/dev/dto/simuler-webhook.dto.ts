import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt } from 'class-validator';

/**
 * DTO pour simuler un webhook FedaPay en développement.
 */
export class SimulerWebhookDto {
  @ApiProperty({
    description: 'Identifiant interne de la transaction à simuler.',
  })
  @IsInt()
  transactionId!: number;

  @ApiProperty({
    enum: ['approuve', 'refuse'],
    description: 'Résultat à simuler.',
  })
  @IsEnum(['approuve', 'refuse'])
  resultat!: 'approuve' | 'refuse';
}
