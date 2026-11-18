import { PartialType } from '@nestjs/swagger';
import { CreateEcritureComptableDto } from './create-ecriture-comptable.dto';

/**
 * DTO de mise à jour d'une écriture comptable. Aucune route PATCH n'est exposée
 * (les écritures sont immuables) : ce fichier n'existe que par cohérence avec la
 * structure standard d'un dossier de table.
 */
export class UpdateEcritureComptableDto extends PartialType(CreateEcritureComptableDto) {}
