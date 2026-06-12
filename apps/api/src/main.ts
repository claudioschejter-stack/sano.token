import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // 1. Escudo de cabeceras HTTP con Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'same-site' }
    })
  );

  // 2. Configuración dinámica y restrictiva de CORS
  const allowedOrigins = (
    configService.get<string>('FRONTEND_ORIGINS') ??
    configService.get<string>('WEB_ORIGIN') ??
    'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const nodeEnv = configService.get<string>('NODE_ENV') ?? 'development';

  app.enableCors({
    origin(origin, callback) {
      // Sin Origin: healthchecks (Railway), curl, server-to-server — CORS no aplica a navegadores
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by Sanova API CORS policy.'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 86_400 // 24 horas de caché para peticiones preflight
  });

  // 3. Tubería de validación global (Filtra datos maliciosos entrantes)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();

  const port = Number(configService.get<string>('PORT') ?? 4000);
  await app.listen(port);
  logger.log(`Sanova Global API running securely on http://localhost:${port}/api/v1`);

  const shutdown = async (signal: string) => {
    logger.warn(`Received ${signal}. Shutting down gracefully…`);
    await app.close();
    process.exit(0);
  };

  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
}

bootstrap();