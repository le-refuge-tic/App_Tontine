import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MembreService } from './membre.service';
import { UpdateMembreDto } from './dto/update-membre.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from './entities/membre.entity';

/**
 * Contrôleur des membres.
 * - Liste et suppression : admin seulement.
 * - Lecture et modification : soi-même ou admin.
 * - Création directe : admin seulement (inscription publique → POST /auth/inscription).
 */
@ApiTags('membres')
@ApiBearerAuth()
@Controller('membres')
export class MembreController {
  constructor(private readonly service: MembreService) {}

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Liste tous les membres. Admin seulement.' })
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Renvoie un membre. Soi-même ou admin.' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @UtilisateurCourant() courant: Membre,
  ) {
    // 404 si le membre tente d'accéder au compte d'un autre (ne pas révéler l'existence)
    if (courant.role !== Role.ADMIN && courant.id !== id) {
      throw new NotFoundException(`Membre introuvable : ${id}.`);
    }
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Met à jour nom/phone. Soi-même ou admin.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMembreDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    // 404 si le membre tente de modifier le compte d'un autre (ne pas révéler l'existence)
    if (courant.role !== Role.ADMIN && courant.id !== id) {
      throw new NotFoundException(`Membre introuvable : ${id}.`);
    }
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Supprime un membre. Admin seulement.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
