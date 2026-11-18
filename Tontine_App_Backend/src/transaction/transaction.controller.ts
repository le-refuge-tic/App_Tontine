import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }
}
