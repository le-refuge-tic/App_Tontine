/**
 * Configuration de connexion à la base de données PostgreSQL.
 */
export interface DbConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

/**
 * Configuration de l'intégration FedaPay.
 */
export interface FedapayConfig {
  env: 'sandbox' | 'live';
  secretKey: string;
  webhookSecret: string;
  appPublicUrl: string;
}

/**
 * Configuration CORS.
 */
export interface CorsConfig {
  origin: string;
}

/**
 * Configuration JWT (access token, refresh token, jeton de retrait).
 */
export interface JwtConfig {
  secret: string;
  accessExpiresIn: string;
  refreshExpiresInDays: number;
  retraitExpiresIn: string;
}

/**
 * Configuration du throttling (limitation de débit).
 */
export interface ThrottleConfig {
  ttl: number;
  limit: number;
}

/**
 * Configuration bcrypt.
 */
export interface BcryptConfig {
  rounds: number;
}

/**
 * Configuration du premier administrateur (seed uniquement).
 */
export interface AdminConfig {
  phone: string | undefined;
  password: string | undefined;
}

/**
 * Configuration applicative complète, exposée via `@nestjs/config`.
 */
export interface AppConfig {
  nodeEnv: 'development' | 'production' | 'test';
  port: number;
  db: DbConfig;
  fedapay: FedapayConfig;
  cors: CorsConfig;
  jwt: JwtConfig;
  throttle: ThrottleConfig;
  bcrypt: BcryptConfig;
  admin: AdminConfig;
}

/**
 * Chargeur de configuration : lit les variables d'environnement et les
 * structure sous forme typée. Les valeurs manquantes prennent un défaut
 * défensif ; la validation réelle est assurée par le schéma Joi.
 */
export default function configuration(): AppConfig {
  return {
    nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
    port: Number(process.env.PORT ?? 3000),
    db: {
      host: process.env.DB_HOST ?? '',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? '',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? '',
    },
    fedapay: {
      env: (process.env.FEDAPAY_ENV as FedapayConfig['env']) ?? 'sandbox',
      secretKey: process.env.FEDAPAY_SECRET_KEY ?? '',
      webhookSecret: process.env.FEDAPAY_WEBHOOK_SECRET ?? '',
      appPublicUrl: process.env.APP_PUBLIC_URL ?? '',
    },
    cors: {
      origin: process.env.CORS_ORIGIN ?? '*',
    },
    jwt: {
      secret: process.env.JWT_SECRET ?? '',
      accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
      refreshExpiresInDays: Number(
        process.env.JWT_REFRESH_EXPIRES_IN_DAYS ?? 30,
      ),
      retraitExpiresIn: process.env.JWT_RETRAIT_EXPIRES_IN ?? '5m',
    },
    throttle: {
      ttl: Number(process.env.THROTTLE_TTL ?? 60000),
      limit: Number(process.env.THROTTLE_LIMIT ?? 60),
    },
    bcrypt: {
      rounds: Number(process.env.BCRYPT_ROUNDS ?? 12),
    },
    admin: {
      phone: process.env.ADMIN_PHONE,
      password: process.env.ADMIN_PASSWORD,
    },
  };
}
