import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { DepotService } from './depot.service';
import { DepotController } from './depot.controller';
import { FedapayModule } from '../fedapay/fedapay.module';
import { CycleModule } from '../cycle/cycle.module';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction, Membre]),
    FedapayModule,
    CycleModule,
    ParametreSystemeModule,
  ],
  providers: [DepotService],
  controllers: [DepotController],
  exports: [DepotService],
})
export class DepotModule {}
