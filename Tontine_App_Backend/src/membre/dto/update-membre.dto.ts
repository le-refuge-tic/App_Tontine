import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO de mise à jour d'un membre.
 * Seuls nom et phone sont modifiables ici.
 * Le password → /auth/changer-password
 * Le codeRetrait → /auth/code-retrait
 * Le role et statut → jamais modifiables par le client.
 */
export class UpdateMembreDto {
  @ApiPropertyOptional({ example: 'Alice Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nom?: string;

  @ApiPropertyOptional({ example: '97000001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;
}
