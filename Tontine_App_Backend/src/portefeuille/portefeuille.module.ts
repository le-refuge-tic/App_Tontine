import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portefeuille } from './entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { PortefeuilleService } from './portefeuille.service';
import { PortefeuilleController } from './portefeuille.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Portefeuille, EcritureComptable, Transaction])],
  providers: [PortefeuilleService],
  controllers: [PortefeuilleController],
  exports: [PortefeuilleService],
})
export class PortefeuilleModule {}
