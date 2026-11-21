import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookFedapayService } from './webhook-fedapay.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

/** Requete Express avec le corps brut expose par rawBody: true. */
type RawBodyRequest = Request & { rawBody?: Buffer };

@ApiTags('webhooks-fedapay')
@Controller('webhooks')
export class WebhookFedapayController {
  constructor(private readonly service: WebhookFedapayService) {}

  /**
   * Endpoint public FedaPay.
   * @Public car FedaPay n'envoie pas de JWT.
   * La signature HMAC est verifiee dans le service.
   */
  @ApiOperation({ summary: 'Webhook FedaPay (endpoint public)' })
  @Public()
  @Post('fedapay')
  @HttpCode(HttpStatus.OK)
  recevoir(
    @Req() req: RawBodyRequest,
    @Headers('x-fedapay-signature') signature: string,
  ) {
    const rawBody = req.rawBody ?? Buffer.from('{}');
    return this.service.traiter(rawBody, signature);
  }

  @ApiOperation({ summary: 'Lister tous les webhooks (admin)' })
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @ApiOperation({ summary: 'Detail webhook (admin)' })
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
