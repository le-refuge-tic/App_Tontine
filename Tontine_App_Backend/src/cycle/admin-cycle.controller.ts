import { Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CycleService } from './cycle.service';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

/**
 * Routes d'administration des cycles. Permet de déclencher à la main la
 * clôture des cycles échus (utile en test, ou pour forcer un passage).
 */
@ApiTags('admin/cycles')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin/cycles')
export class AdminCycleController {
  constructor(private readonly service: CycleService) {}

  @Post('cloturer-echus')
  @ApiOperation({
    summary:
      'Clôture manuellement les cycles échus et génère les cycles suivants (admin).',
  })
  cloturerEchus() {
    return this.service.cloturerEchus();
  }
}
