import { PartialType } from '@nestjs/swagger';
import { CreateRemboursementDto } from './create-remboursement.dto';

export class UpdateRemboursementDto extends PartialType(CreateRemboursementDto) {}
