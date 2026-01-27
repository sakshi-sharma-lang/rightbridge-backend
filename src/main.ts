  import { ValidationPipe, BadRequestException } from '@nestjs/common';
  import { NestFactory } from '@nestjs/core';
  import { AppModule } from './app.module';
  import * as express from 'express';
  import { join } from 'path';
  import * as bodyParser from 'body-parser';

  async function bootstrap() {
    const app = await NestFactory.create(AppModule);

      // Enable CORS
    app.enableCors({
      //origin: process.env.FRONTEND_URL,
      origin: ['http://localhost:3000', 'http://localhost:3093/','https://rightbridge.csdevhub.com', 'http://localhost:3001'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    });
    
    // app.useGlobalPipes(
    //   new ValidationPipe({
    //     whitelist: true,            // strips properties not in DTO
    //     forbidNonWhitelisted: true, // throws error if extra props sent
    //     transform: true,            // converts payload to DTO instance
    //   }),
    // );

  app.use(
    '/payments/webhook',
    bodyParser.raw({ type: 'application/json' }),
  );

   app.use(
    '/sumsub/webhook',
    bodyParser.raw({
      type: 'application/json',
      verify: (req: any, res, buf) => {
        req.rawBody = buf.toString();
      },
    }),
  );



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
    require('express').static('additional-info/docs-uploads'),
  );

app.use(
  '/uploads',
  require('express').static('uploads'),
);


    const port = process.env.PORT || 4000;
    await app.listen(port);
    console.log(`Server running on port ${port}`);
  }
  bootstrap();
