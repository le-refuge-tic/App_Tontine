import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookFedapay } from './entities/webhook-fedapay.entity';
import { WebhookFedapayService } from './webhook-fedapay.service';
import { WebhookFedapayController } from './webhook-fedapay.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WebhookFedapay])],
  providers: [WebhookFedapayService],
  controllers: [WebhookFedapayController],
  exports: [WebhookFedapayService],
})
export class WebhookFedapayModule {}
