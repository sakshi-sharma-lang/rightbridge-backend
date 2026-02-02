import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as express from 'express';
import { join } from 'path';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ================= SUMSUB WEBHOOK (RAW BODY SAFE) =================
  app.use(
    '/sumsub/webhook',
    bodyParser.json({
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );

  // ================= PAYMENTS WEBHOOK =================
  app.use(
    '/payments/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

  // ================= REST OF APP =================
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'http://localhost:3093',
      'https://rightbridge.csdevhub.com',
      'http://localhost:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-sumsub-signature',
      'x-sumsub-timestamp',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) => {
        const firstError = errors[0];
        const message = firstError?.constraints
          ? Object.values(firstError.constraints)[0]
          : 'Validation error';
        return new BadRequestException(message);
      },
    }),
  );

  app.use(
    '/additional-info/docs-uploads',
    express.static(join(process.cwd(), 'additional-info/docs-uploads')),
  );

  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 Server running on port ${port}`);
}

bootstrap();
