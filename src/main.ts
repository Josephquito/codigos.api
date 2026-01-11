import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      'http://localhost:4200',
      'http://jotavix.com',
      'https://jotavix.com',
      'http://www.jotavix.com',
      'https://www.jotavix.com',
      'https://connivant-maegan-overpiteous.ngrok-free.dev',
    ],
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
