import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { TypeTransaction } from '../../common/enums';

/**
 * DTO de création d'une transaction. Usage interne uniquement : la création
 * publique est interdite (les transactions sont créées par les services
 * métier via FedaPay).
 */
export class CreateTransactionDto {
  @ApiProperty({ enum: TypeTransaction, description: 'Type de transaction.' })
  @IsEnum(TypeTransaction)
  type!: TypeTransaction;

  @ApiProperty({ example: 5000, description: 'Montant (FCFA, strictement positif).' })
  @IsInt()
  @Min(1)
  montant!: number;

  @ApiPropertyOptional({ example: 0, description: 'Frais FedaPay (FCFA), payés par le membre.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  fraisFedapay?: number;

  @ApiProperty({ description: 'Référence unique de la transaction.' })
  @IsString()
  referenceUnique!: string;

  @ApiPropertyOptional({ description: 'Identifiant FedaPay (renseigné à la confirmation).' })
  @IsOptional()
  @IsString()
  idFedapay?: string;

  @ApiProperty({ description: 'Membre concerné par la transaction.' })
  @IsInt()
  membreId!: number;
}
