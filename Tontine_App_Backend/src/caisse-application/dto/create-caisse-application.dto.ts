import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsInt, Min } from 'class-validator';
import { SourceCaisse } from '../../common/enums';

/**
 * DTO de création d'un encaissement de caisse d'application. Usage interne
 * uniquement : la création publique est interdite.
 */
export class CreateCaisseApplicationDto {
  @ApiProperty({ enum: SourceCaisse, description: 'Source de l\u2019encaissement.' })
  @IsEnum(SourceCaisse)
  source!: SourceCaisse;

  @ApiProperty({ example: 5000, description: 'Montant (FCFA, strictement positif).' })
  @IsInt()
  @Min(1)
  montant!: number;

  @ApiProperty({ example: '2026-01-01', description: "Date de l'encaissement (AAAA-MM-JJ)." })
  @IsDateString()
  date!: string;

  @ApiProperty({ description: 'Écriture comptable associée (obligatoire et unique).' })
  @IsInt()
  ecritureComptableId!: number;
}
