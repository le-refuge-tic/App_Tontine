// Charger le .env AVANT tout import NestJS pour que process.env.NODE_ENV
// soit disponible lors de l'évaluation des imports statiques (ex: app.module.ts).
import 'dotenv/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { FedapayConfig } from './config/configuration';

async function bootstrap(): Promise<void> {
  // rawBody activé pour la vérification de signature du webhook FedaPay.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);

  // Garde de démarrage : refuser live FedaPay hors production.
  const fedapay = config.get<FedapayConfig>('fedapay');
  if (fedapay?.env === 'live' && process.env.NODE_ENV !== 'production') {
    throw new Error(
      'FEDAPAY_ENV=live est interdit hors NODE_ENV=production. ' +
        'Utilisez FEDAPAY_ENV=sandbox en développement.',
    );
  }

  // Préfixe global des routes : /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Validation globale des DTO entrants.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Sérialisation globale : applique @Exclude() / @Expose() (password, codeRetrait).
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  // CORS configurable via CORS_ORIGIN (liste séparée par des virgules, ou '*').
  const corsOrigin = config.get<string>('cors.origin') ?? '*';
  app.enableCors({
    origin:
      corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
  });

  // Documentation Swagger sur /api/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Tontine API')
    .setDescription("API backend de l'application mobile de tontine")
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);
}

void bootstrap();
