import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RetraitService } from './retrait.service';
import { CreerRetraitDto } from './dto/creer-retrait.dto';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Membre } from '../membre/entities/membre.entity';

@ApiTags('retraits')
@ApiBearerAuth()
@Controller('retraits')
export class RetraitController {
  constructor(private readonly retraitService: RetraitService) {}

  @ApiOperation({
    summary: 'Initier un retrait de cotisation vers Mobile Money',
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  creer(@UtilisateurCourant() courant: Membre, @Body() dto: CreerRetraitDto) {
    return this.retraitService.creer(courant.id, dto);
  }
}
