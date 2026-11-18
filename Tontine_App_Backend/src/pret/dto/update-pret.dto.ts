import { PartialType } from '@nestjs/swagger';
import { CreatePretDto } from './create-pret.dto';

export class UpdatePretDto extends PartialType(CreatePretDto) {}
