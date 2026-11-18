import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EpargneService } from './epargne.service';
import { CreateEpargneDto } from './dto/create-epargne.dto';
import { UpdateEpargneDto } from './dto/update-epargne.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('epargnes')
@ApiBearerAuth()
@Controller('epargnes')
export class EpargneController {
  constructor(private readonly service: EpargneService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Post()
  create(@Body() dto: CreateEpargneDto, @UtilisateurCourant() courant: Membre) {
    const membreId = courant.role !== Role.ADMIN ? courant.id : dto.membreId;
    return this.service.create(dto, membreId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEpargneDto, @UtilisateurCourant() courant: Membre) {
    return this.service.update(id, dto, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
