import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser = require('cookie-parser');
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  app.enableCors({
    origin: [frontend, 'http://localhost:5173', 'http://localhost:8080'],
    credentials: true,
  });

  const port = Number(process.env.PORT || 3010);
  await app.listen(port);
}

bootstrap();
