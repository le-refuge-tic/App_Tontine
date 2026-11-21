import { Controller, DefaultValuePipe, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RapportService } from './rapport.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('rapport')
@ApiBearerAuth()
@Controller('rapport')
export class RapportController {
  constructor(private readonly rapportService: RapportService) {}

  @ApiOperation({
    summary: 'Rapport mensuel des écritures comptables',
    description:
      'Retourne les écritures du mois demandé, filtrées par type, ' +
      'avec les totaux (cotisé, retiré, fonds retenus).',
  })
  @ApiQuery({
    name: 'mois',
    required: true,
    type: String,
    description: 'Mois au format AAAA-MM (ex. 2025-01)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    enum: ['tout', 'cotisations', 'retraits'],
    description: "Filtre par type d'écriture",
  })
  @Get()
  rapport(
    @UtilisateurCourant() courant: Membre,
    @Query('mois') mois: string,
    @Query('type', new DefaultValuePipe('tout'))
    type: 'tout' | 'cotisations' | 'retraits',
  ) {
    return this.rapportService.rapport(courant.id, mois, type);
  }
}
