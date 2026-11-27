import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EpargneService } from './epargne.service';
import { RetraitEpargneService } from '../retrait-epargne/retrait-epargne.service';
import { CreateEpargneDto } from './dto/create-epargne.dto';
import { UpdateEpargneDto } from './dto/update-epargne.dto';
import { AjouterDepotEpargneDto } from './dto/ajouter-depot-epargne.dto';
import { CreateRetraitEpargneDto } from '../retrait-epargne/dto/create-retrait-epargne.dto';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('epargnes')
@ApiBearerAuth()
@Controller('epargnes')
export class EpargneController {
  constructor(
    private readonly epargneService: EpargneService,
    private readonly retraitEpargneService: RetraitEpargneService,
  ) {}

  @ApiOperation({ summary: 'Lister mes épargnes (avec aperçu de retrait).' })
  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.epargneService.findAll(courant.id);
  }

  @ApiOperation({
    summary: 'Créer une épargne + initier le dépôt initial via FedaPay.',
  })
  @Post()
  @HttpCode(HttpStatus.OK)
  creer(@Body() dto: CreateEpargneDto, @UtilisateurCourant() courant: Membre) {
    return this.epargneService.creer(courant.id, dto);
  }

  @ApiOperation({ summary: "Détail d'une épargne (avec aperçu de retrait)." })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.epargneService.findOne(id, courant.id);
  }

  @ApiOperation({
    summary:
      "Modifier le nom et/ou l'objectif d'une epargne active (PATCH). " +
      "Aucun champ d'argent modifiable. " +
      "404 si l'epargne n'est pas la votre, 409 si elle n'est pas active.",
  })
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  modifier(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEpargneDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.epargneService.modifier(courant.id, id, dto);
  }

  @ApiOperation({ summary: "Ajouter de l'argent à une épargne active." })
  @Post(':id/depots')
  @HttpCode(HttpStatus.OK)
  ajouterDepot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AjouterDepotEpargneDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.epargneService.ajouterDepot(courant.id, id, dto);
  }

  @ApiOperation({
    summary: "Initier un retrait d'épargne vers Mobile Money (jeton requis).",
  })
  @Post(':id/retraits')
  @HttpCode(HttpStatus.CREATED)
  creerRetrait(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateRetraitEpargneDto,
    @UtilisateurCourant() courant: Membre,
  ) {
    return this.retraitEpargneService.creer(courant.id, id, dto);
  }
}
