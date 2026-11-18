import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CaisseApplicationService } from './caisse-application.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

/** Caisse d'application — admin seulement, lecture seule. */
@ApiTags('caisse-application')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('caisse-application')
export class CaisseApplicationController {
  constructor(private readonly service: CaisseApplicationService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
