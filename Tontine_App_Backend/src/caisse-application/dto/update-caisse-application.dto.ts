import { PartialType } from '@nestjs/swagger';
import { CreateCaisseApplicationDto } from './create-caisse-application.dto';

export class UpdateCaisseApplicationDto extends PartialType(CreateCaisseApplicationDto) {}
