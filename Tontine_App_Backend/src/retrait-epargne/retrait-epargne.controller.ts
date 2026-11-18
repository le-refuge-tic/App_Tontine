import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RetraitEpargneService } from './retrait-epargne.service';
import { CreateRetraitEpargneDto } from './dto/create-retrait-epargne.dto';
import { UpdateRetraitEpargneDto } from './dto/update-retrait-epargne.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('retraits-epargne')
@ApiBearerAuth()
@Controller('retraits-epargne')
export class RetraitEpargneController {
  constructor(private readonly service: RetraitEpargneService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Post()
  @Roles(Role.ADMIN)
  create(@Body() dto: CreateRetraitEpargneDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRetraitEpargneDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
