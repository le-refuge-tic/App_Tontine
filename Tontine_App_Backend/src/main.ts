import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
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
