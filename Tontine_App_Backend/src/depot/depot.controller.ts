import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DepotService } from './depot.service';
import { CreerDepotDto } from './dto/creer-depot.dto';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('depots')
@ApiBearerAuth()
@Controller('depots')
export class DepotController {
  constructor(private readonly depotService: DepotService) {}

  @ApiOperation({
    summary: 'Initier un dépôt Mobile Money via FedaPay',
    description:
      "Sans `jourIds` : paie le jour de cotisation d'aujourd'hui. " +
      'Avec `jourIds` : rattrapage des jours fournis.',
  })
  @Post()
  @HttpCode(HttpStatus.OK)
  creer(@UtilisateurCourant() courant: Membre, @Body() dto: CreerDepotDto) {
    return this.depotService.creer(courant.id, dto);
  }
}
