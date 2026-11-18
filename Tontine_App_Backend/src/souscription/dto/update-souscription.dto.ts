import { PartialType } from '@nestjs/swagger';
import { CreateSouscriptionDto } from './create-souscription.dto';

export class UpdateSouscriptionDto extends PartialType(CreateSouscriptionDto) {}
