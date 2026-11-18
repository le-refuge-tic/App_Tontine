import { PartialType } from '@nestjs/swagger';
import { CreateRetraitEpargneDto } from './create-retrait-epargne.dto';

export class UpdateRetraitEpargneDto extends PartialType(CreateRetraitEpargneDto) {}
