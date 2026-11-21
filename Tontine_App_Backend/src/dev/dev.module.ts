import { Module } from '@nestjs/common';
import { DevController } from './dev.controller';
import { WebhookFedapayModule } from '../webhook-fedapay/webhook-fedapay.module';

/**
 * Module de développement. Importé conditionnellement dans `AppModule`
 * uniquement si `NODE_ENV === 'development'`.
 */
@Module({
  imports: [WebhookFedapayModule],
  controllers: [DevController],
})
export class DevModule {}
