import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EcritureComptableService } from './ecriture-comptable.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

/** Grand livre — lecture seule. Jamais de PATCH ni DELETE. */
@ApiTags('ecritures-comptables')
@ApiBearerAuth()
@Controller('ecritures-comptables')
export class EcritureComptableController {
  constructor(private readonly service: EcritureComptableService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }
}
