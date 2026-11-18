import { PartialType } from '@nestjs/swagger';
import { CreateJourCotisationDto } from './create-jour-cotisation.dto';

export class UpdateJourCotisationDto extends PartialType(CreateJourCotisationDto) {}
