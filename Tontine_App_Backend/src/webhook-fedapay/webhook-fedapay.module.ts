import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookFedapay } from './entities/webhook-fedapay.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { WebhookFedapayService } from './webhook-fedapay.service';
import { WebhookFedapayController } from './webhook-fedapay.controller';
import { FedapayModule } from '../fedapay/fedapay.module';
import { TransactionModule } from '../transaction/transaction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WebhookFedapay, Transaction]),
    FedapayModule,
    TransactionModule,
  ],
  providers: [WebhookFedapayService],
  controllers: [WebhookFedapayController],
  exports: [WebhookFedapayService],
})
export class WebhookFedapayModule {}
