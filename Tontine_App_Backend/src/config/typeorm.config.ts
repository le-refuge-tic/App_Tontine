import { DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from '../common/naming-strategies/snake-naming.strategy';
import { DbConfig } from './configuration';
import { Membre } from '../membre/entities/membre.entity';
import { Souscription } from '../souscription/entities/souscription.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { CaisseApplication } from '../caisse-application/entities/caisse-application.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { RetraitEpargne } from '../retrait-epargne/entities/retrait-epargne.entity';
import { Pret } from '../pret/entities/pret.entity';
import { Garantie } from '../garantie/entities/garantie.entity';
import { Remboursement } from '../remboursement/entities/remboursement.entity';
import { ParametreSysteme } from '../parametre-systeme/entities/parametre-systeme.entity';
import { Notification } from '../notification/entities/notification.entity';
import { WebhookFedapay } from '../webhook-fedapay/entities/webhook-fedapay.entity';
import { JetonRafraichissement } from '../jeton-rafraichissement/entities/jeton-rafraichissement.entity';

/** Liste centralisée des 17 entités du projet (16 métier + 1 technique). */
export const entities = [
  Membre,
  Souscription,
  Cycle,
  JourCotisation,
  Portefeuille,
  Transaction,
  EcritureComptable,
  CaisseApplication,
  Epargne,
  RetraitEpargne,
  Pret,
  Garantie,
  Remboursement,
  ParametreSysteme,
  Notification,
  WebhookFedapay,
  JetonRafraichissement,
];

/**
 * Construit les options du `DataSource` PostgreSQL partagées par l'application
 * (`TypeOrmModule.forRootAsync`) et par le `data-source.ts` du CLI TypeORM.
 * `synchronize` est TOUJOURS faux : les migrations sont obligatoires.
 */
export function buildDataSourceOptions(db: DbConfig): DataSourceOptions {
  return {
    type: 'postgres',
    host: db.host,
    port: db.port,
    username: db.user,
    password: db.password,
    database: db.database,
    synchronize: false,
    namingStrategy: new SnakeNamingStrategy(),
    entities,
    logging: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  };
}
