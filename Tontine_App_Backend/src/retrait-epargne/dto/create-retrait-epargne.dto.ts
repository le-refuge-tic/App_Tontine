import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, Min } from 'class-validator';

export class CreateRetraitEpargneDto {
  @ApiProperty({ description: 'Épargne retirée.' })
  @IsInt()
  epargneId!: number;

  @ApiProperty({ example: 10000, description: 'Montant retiré (FCFA).' })
  @IsInt()
  @Min(0)
  montant!: number;

  @ApiProperty({ example: 2.75, description: 'Taux appliqué (numeric 5,2).' })
  @IsNumber()
  @Min(0)
  tauxApplique!: number;

  @ApiProperty({ example: 275, description: 'Montant retenu (FCFA).' })
  @IsInt()
  @Min(0)
  montantRetenu!: number;

  @ApiProperty({ description: 'Transaction qui paie le retrait (OneToOne obligatoire).' })
  @IsInt()
  transactionId!: number;
}
