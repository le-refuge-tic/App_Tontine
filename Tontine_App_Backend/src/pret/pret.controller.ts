import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PretService } from './pret.service';
import { CreatePretDto } from './dto/create-pret.dto';
import { UpdatePretDto } from './dto/update-pret.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('prets')
@ApiBearerAuth()
@Controller('prets')
export class PretController {
  constructor(private readonly service: PretService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Post()
  create(@Body() dto: CreatePretDto, @UtilisateurCourant() courant: Membre) {
    const membreId = courant.role !== Role.ADMIN ? courant.id : undefined;
    return this.service.create(dto, membreId);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePretDto, @UtilisateurCourant() courant: Membre) {
    return this.service.update(id, dto, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
