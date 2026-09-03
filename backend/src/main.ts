import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

function corsOrigins(): string[] {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const origins = [frontend];
  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173', 'http://localhost:8080');
  }
  return [...new Set(origins)];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: false,
    }),
  );
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
  });

  const port = Number(process.env.PORT || 3010);
  await app.listen(port);
}

bootstrap();
