import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WebhookFedapayService } from './webhook-fedapay.service';
import { CreateWebhookFedapayDto } from './dto/create-webhook-fedapay.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@ApiTags('webhooks-fedapay')
@Controller('webhooks-fedapay')
export class WebhookFedapayController {
  constructor(private readonly service: WebhookFedapayService) {}

  /**
   * Endpoint public FedaPay. @Public car FedaPay n'envoie pas de JWT.
   * TODO(webhook-signature): ajouter la vérification de signature FedaPay.
   */
  @Public()
  @Post()
  create(@Body() dto: CreateWebhookFedapayDto) {
    return this.service.create(dto);
  }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get()
  findAll() { return this.service.findAll(); }

  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
