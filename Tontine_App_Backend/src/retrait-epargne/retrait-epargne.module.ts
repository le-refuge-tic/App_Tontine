import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetraitEpargne } from './entities/retrait-epargne.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import { RetraitEpargneService } from './retrait-epargne.service';
import { FedapayModule } from '../fedapay/fedapay.module';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';
import { AuthModule } from '../auth/auth.module';

/**
 * Module des retraits d'épargne. Ne déclare aucun contrôleur : la route
 * `POST /epargnes/:id/retraits` est exposée par `EpargneController`, qui
 * délègue à `RetraitEpargneService`. Ce module fournit et exporte le service.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      RetraitEpargne,
      Epargne,
      Transaction,
      Membre,
      JetonRetraitConsomme,
    ]),
    FedapayModule,
    ParametreSystemeModule,
    // JwtService (vérification du jeton de retrait à usage unique).
    AuthModule,
  ],
  providers: [RetraitEpargneService],
  controllers: [],
  exports: [RetraitEpargneService],
})
export class RetraitEpargneModule {}
