import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CycleService } from './cycle.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('cycles')
@ApiBearerAuth()
@Controller('cycles')
export class CycleController {
  constructor(private readonly service: CycleService) {}

  @Get()
  @ApiOperation({
    summary: 'Liste les cycles. Membre : les siens. Admin : tous.',
  })
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(
      courant.role === Role.ADMIN ? undefined : courant.id,
    );
  }

  @Get('en-cours')
  @ApiOperation({
    summary:
      'Cycle en cours du membre connecté, ses jours et la prochaine échéance (404 sinon).',
  })
  enCours(@UtilisateurCourant() courant: Membre) {
    return this.service.enCours(courant.id);
  }

  @Get('jours-rattrapables')
  @ApiOperation({
    summary:
      'Jours « perdu » du membre (tous cycles confondus), avec leur cycle.',
  })
  joursRattrapables(@UtilisateurCourant() courant: Membre) {
    return this.service.joursRattrapables(courant.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Renvoie un cycle.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.service.findOne(
      id,
      courant.role === Role.ADMIN ? undefined : courant.id,
    );
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Crée un cycle. Admin seulement.' })
  create(@Body() dto: CreateCycleDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Met à jour un cycle. Admin seulement.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCycleDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprime un cycle. Admin seulement.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
