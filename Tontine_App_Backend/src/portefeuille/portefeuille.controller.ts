import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PortefeuilleService } from './portefeuille.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('portefeuilles')
@ApiBearerAuth()
@Controller('portefeuilles')
export class PortefeuilleController {
  constructor(private readonly service: PortefeuilleService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }
}
