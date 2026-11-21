import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsInt, IsOptional } from 'class-validator';

/**
 * DTO pour créer un dépôt. Sans `jourIds`, le service prend le jour de
 * cotisation du jour courant. Avec `jourIds`, il effectue un rattrapage.
 */
export class CreerDepotDto {
  @ApiPropertyOptional({
    type: [Number],
    description:
      "Identifiants des jours de cotisation à payer. Absent = jour d'aujourd'hui.",
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  jourIds?: number[];
}
