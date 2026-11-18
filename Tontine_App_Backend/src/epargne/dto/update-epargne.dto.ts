import { PartialType } from '@nestjs/swagger';
import { CreateEpargneDto } from './create-epargne.dto';

export class UpdateEpargneDto extends PartialType(CreateEpargneDto) {}
