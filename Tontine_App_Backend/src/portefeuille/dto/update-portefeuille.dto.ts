import { PartialType } from '@nestjs/swagger';
import { CreatePortefeuilleDto } from './create-portefeuille.dto';

export class UpdatePortefeuilleDto extends PartialType(CreatePortefeuilleDto) {}
