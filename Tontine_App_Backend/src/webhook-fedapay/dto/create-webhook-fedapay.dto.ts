import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * DTO d'enregistrement d'un webhook FedaPay. Le payload est conservé brut
 * (jsonb) pour traitement ultérieur.
 */
export class CreateWebhookFedapayDto {
  @ApiProperty({ description: "Type d'événement FedaPay." })
  @IsString()
  evenement!: string;

  @ApiProperty({ description: 'Payload brut reçu de FedaPay (objet JSON).' })
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    example: false,
    description: 'Indique si le webhook a été traité.',
  })
  @IsOptional()
  @IsBoolean()
  traite?: boolean;
}
