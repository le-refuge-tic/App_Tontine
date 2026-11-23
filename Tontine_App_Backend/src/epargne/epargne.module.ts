import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epargne } from './entities/epargne.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { EpargneService } from './epargne.service';
import { EpargneController } from './epargne.controller';
import { FedapayModule } from '../fedapay/fedapay.module';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';
import { RetraitEpargneModule } from '../retrait-epargne/retrait-epargne.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Epargne, Transaction, Membre]),
    FedapayModule,
    ParametreSystemeModule,
    // RetraitEpargneService pour la route POST /epargnes/:id/retraits.
    RetraitEpargneModule,
  ],
  providers: [EpargneService],
  controllers: [EpargneController],
  exports: [EpargneService],
})
export class EpargneModule {}
