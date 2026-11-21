import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { WebhookFedapayService } from '../webhook-fedapay/webhook-fedapay.service';
import { SimulerWebhookDto } from './dto/simuler-webhook.dto';
import { Public } from '../common/decorators/public.decorator';

/**
 * Contrôleur de développement. Routes uniquement disponibles en
 * `NODE_ENV=development` (le module n'est pas importé en production).
 */
@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private readonly webhookService: WebhookFedapayService) {}

  @ApiOperation({
    summary: '[DEV] Simuler un webhook FedaPay sans vérification de signature',
  })
  @Public()
  @Post('simuler-webhook')
  @HttpCode(HttpStatus.OK)
  simulerWebhook(@Body() dto: SimulerWebhookDto) {
    return this.webhookService.traiterDirectement(
      dto.transactionId,
      dto.resultat,
    );
  }
}
