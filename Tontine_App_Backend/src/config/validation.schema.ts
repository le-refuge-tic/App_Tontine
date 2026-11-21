import * as Joi from 'joi';

/**
 * Schéma de validation des variables d'environnement (validé par @nestjs/config
 * au démarrage via Joi). L'application refuse de démarrer si une variable
 * requise est absente ou invalide.
 */
export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().port().default(3000),

  // ---- Base de données ----
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(5432),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_NAME: Joi.string().required(),

  // ---- FedaPay ----
  FEDAPAY_ENV: Joi.string().valid('sandbox', 'live').default('sandbox'),
  FEDAPAY_SECRET_KEY: Joi.string().allow('').default(''),

  // ---- CORS ----
  CORS_ORIGIN: Joi.string().default('*'),

  // ---- JWT ----
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN_DAYS: Joi.number().integer().min(1).default(30),
  JWT_RETRAIT_EXPIRES_IN: Joi.string().default('5m'),

  // ---- Bcrypt ----
  BCRYPT_ROUNDS: Joi.number().integer().min(10).max(14).default(12),

  // ---- Throttling ----
  THROTTLE_TTL: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(60),

  // ---- Admin (seed) ----
  ADMIN_PHONE: Joi.string().allow('').optional(),
  ADMIN_PASSWORD: Joi.string().allow('').optional(),

  // ---- FedaPay webhook + URL publique ----
  FEDAPAY_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  APP_PUBLIC_URL: Joi.string().uri().allow('').default(''),
  APP_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
