import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { TransactionService } from './transaction.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
export class TransactionController {
  constructor(private readonly service: TransactionService) {}

  @ApiOperation({ summary: 'Lister les transactions (paginees)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limite', required: false, type: Number })
  @Get()
  findAll(
    @UtilisateurCourant() courant: Membre,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limite', new DefaultValuePipe(20), ParseIntPipe) limite: number,
  ) {
    const skip = (page - 1) * limite;
    const membreId = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findAll(membreId, { skip, take: limite });
  }

  @ApiOperation({ summary: 'Detail transaction' })
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @UtilisateurCourant() courant: Membre,
  ) {
    const membreId = courant.role === Role.ADMIN ? undefined : courant.id;
    return this.service.findOne(id, membreId);
  }
}
