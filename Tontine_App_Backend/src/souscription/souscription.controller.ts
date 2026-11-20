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
import { CreerSouscriptionDto } from './dto/creer-souscription.dto';
import { DemanderChangementDto } from './dto/demander-changement.dto';
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
  @ApiOperation({
    summary: 'Liste les souscriptions. Membre : les siennes. Admin : toutes.',
  })
  findAll(@UtilisateurCourant() courant: Membre) {
    const filtre = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findAll(filtre);
  }

  @Get('active')
  @ApiOperation({
    summary:
      'Renvoie la souscription active du membre connecté (404 si aucune).',
  })
  trouverActive(@UtilisateurCourant() courant: Membre) {
    return this.service.trouverActive(courant.id);
  }

  @Post('changement')
  @ApiOperation({
    summary:
      'Demande un changement de mise et/ou de régularité (effet au cycle suivant).',
  })
  demanderChangement(
    @Body() dto: DemanderChangementDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.service.demanderChangement(courant.id, dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Renvoie une souscription.' })
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UtilisateurCourant() courant: Membre,
  ) {
    const filtre = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findOne(id, filtre);
  }

  @Post()
  @ApiOperation({
    summary:
      'Crée une souscription pour le membre connecté et génère le cycle 1.',
  })
  creer(
    @Body() dto: CreerSouscriptionDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.service.creerPourMembre(courant.id, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Met à jour une souscription. Admin seulement.' })
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
