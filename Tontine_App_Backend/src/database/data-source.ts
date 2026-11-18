import 'dotenv/config';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/typeorm.config';

/**
 * Source de données utilisée par le CLI TypeORM (`migration:generate`,
 * `migration:run`, `migration:revert`). Charge le fichier `.env` puis expose
 * une unique instance `AppDataSource` (le CLI recherche l'export de type
 * `DataSource`).
 *
 * Les migrations sont découvertes automatiquement dans `src/database/migrations`
 * (développement via ts-node) ou `dist/database/migrations` (production).
 */
export const AppDataSource = new DataSource({
  ...buildDataSourceOptions({
    host: process.env.DB_HOST ?? '',
    port: Number(process.env.DB_PORT ?? 5432),
    user: process.env.DB_USER ?? '',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? '',
  }),
  migrations: [__dirname + '/migrations/*.{ts,js}'],
});
