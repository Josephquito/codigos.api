import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  // Cargar .env SOLO en local
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('dotenv').config();
  }

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

  const port = Number(process.env.PORT) || 3000;

  console.log('BOOT OK', {
    port,
    env: process.env.NODE_ENV,
  });

  await app.listen(port, '0.0.0.0');
}

bootstrap();
