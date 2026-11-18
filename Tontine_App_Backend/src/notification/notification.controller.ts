import { Controller, Get, Param, ParseIntPipe, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Role } from '../common/enums/role.enum';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationController {
  constructor(private readonly service: NotificationService) {}

  /** Liste les notifications du membre connecté (admin : toutes). */
  @Get()
  findAll(@UtilisateurCourant() courant: Membre) {
    return this.service.findAll(courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.findOne(id, courant.role === Role.ADMIN ? undefined : courant.id);
  }

  @Patch(':id/lue')
  markAsRead(@Param('id', ParseIntPipe) id: number, @UtilisateurCourant() courant: Membre) {
    return this.service.markAsRead(
      id,
      courant.role === Role.ADMIN ? undefined : courant.id,
    );
  }
}
