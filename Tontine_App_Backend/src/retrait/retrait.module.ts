import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import { FedapayModule } from '../fedapay/fedapay.module';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';
import { AuthModule } from '../auth/auth.module';
import { RetraitService } from './retrait.service';
import { RetraitController } from './retrait.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      Membre,
      Portefeuille,
      EcritureComptable,
      JetonRetraitConsomme,
    ]),
    FedapayModule,
    ParametreSystemeModule,
    AuthModule,
  ],
  providers: [RetraitService],
  controllers: [RetraitController],
  exports: [RetraitService],
})
export class RetraitModule {}
