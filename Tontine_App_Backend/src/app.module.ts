import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import configuration, { DbConfig } from './config/configuration';
import { validationSchema } from './config/validation.schema';
import { buildDataSourceOptions } from './config/typeorm.config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { JetonRafraichissementModule } from './jeton-rafraichissement/jeton-rafraichissement.module';
import { MembreModule } from './membre/membre.module';
import { SouscriptionModule } from './souscription/souscription.module';
import { CycleModule } from './cycle/cycle.module';
import { JourCotisationModule } from './jour-cotisation/jour-cotisation.module';
import { PortefeuilleModule } from './portefeuille/portefeuille.module';
import { TransactionModule } from './transaction/transaction.module';
import { EcritureComptableModule } from './ecriture-comptable/ecriture-comptable.module';
import { CaisseApplicationModule } from './caisse-application/caisse-application.module';
import { EpargneModule } from './epargne/epargne.module';
import { RetraitEpargneModule } from './retrait-epargne/retrait-epargne.module';
import { PretModule } from './pret/pret.module';
import { GarantieModule } from './garantie/garantie.module';
import { RemboursementModule } from './remboursement/remboursement.module';
import { ParametreSystemeModule } from './parametre-systeme/parametre-systeme.module';
import { NotificationModule } from './notification/notification.module';
import { WebhookFedapayModule } from './webhook-fedapay/webhook-fedapay.module';

const DEFAULT_DB: DbConfig = {
  host: '',
  port: 5432,
  user: '',
  password: '',
  database: '',
};

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      load: [configuration],
      validationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildDataSourceOptions(config.get<DbConfig>('db') ?? DEFAULT_DB),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('throttle.ttl') ?? 60000,
            limit: config.get<number>('throttle.limit') ?? 60,
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    AuthModule,
    JetonRafraichissementModule,
    MembreModule,
    SouscriptionModule,
    CycleModule,
    JourCotisationModule,
    PortefeuilleModule,
    TransactionModule,
    EcritureComptableModule,
    CaisseApplicationModule,
    EpargneModule,
    RetraitEpargneModule,
    PretModule,
    GarantieModule,
    RemboursementModule,
    ParametreSystemeModule,
    NotificationModule,
    WebhookFedapayModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // ── Guards globaux (ordre important : Throttler → JWT → Roles) ──
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
