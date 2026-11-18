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
import { SouscriptionService } from './souscription.service';
import { CreateSouscriptionDto } from './dto/create-souscription.dto';
import { UpdateSouscriptionDto } from './dto/update-souscription.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('souscriptions')
@ApiBearerAuth()
@Controller('souscriptions')
export class SouscriptionController {
  constructor(private readonly service: SouscriptionService) {}

  @Get()
  @ApiOperation({ summary: 'Liste les souscriptions. Membre : les siennes. Admin : toutes.' })
  findAll(@UtilisateurCourant() courant: Membre) {
    const filtre = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findAll(filtre);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Renvoie une souscription.' })
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    const filtre = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findOne(id, filtre);
  }

  @Post()
  @ApiOperation({ summary: 'Crée une souscription.' })
  create(@Body() dto: CreateSouscriptionDto, @UtilisateurCourant() courant: Membre) {
    // Le membre ne peut créer que pour lui-même ; l'admin peut spécifier membreId.
    if (courant.role !== Role.ADMIN) {
      dto.membreId = courant.id;
    }
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour une souscription.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSouscriptionDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    const filtre = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.update(id, dto, filtre);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprime une souscription. Admin seulement.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
