import { PartialType } from '@nestjs/swagger';
import { CreateParametreSystemeDto } from './create-parametre-systeme.dto';

export class UpdateParametreSystemeDto extends PartialType(CreateParametreSystemeDto) {}
