import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { LoggingInterceptor } from './common/interceptors/loging.interceptor';
import { DbRetryInterceptor } from './common/interceptors/db-retry.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { MessageEntity } from './message/message.entity';
import { RequestEntity } from './request/request.entity';
import { TransactionEntity } from './transaction/transaction.entity';
import { TravelEntity } from './travel/travel.entity';
import { UserEntity } from './user/user.entity';
import { AirlineEntity } from './airline/entities/airline.entity';
import { ReviewEntity } from './review/review.entity';
import { KycDiditModule } from './kyc-didit/kyc-didit.module';
import { QuoteEntity } from './quote/entities/quote.entity';
import { SupportModule } from './support/support.module';
import { PlatformPricingEntity } from './platform-pricing/entities/platform-pricing.entity';

//root file ->entry point of nest js application

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule, {
    logger:['error', 'warn','log','debug','verbose'],
    rawBody: true, // Enable raw body for Stripe webhook signature verification
  });
  
  // Get ConfigService instance
  const configService = app.get(ConfigService);
  
  // Set global prefix for all routes
  app.setGlobalPrefix('api');

  // Get environment-specific base URL
  const nodeEnv = configService.get<string>('NODE_ENV') || 'development';
  const port = configService.get<number>('PORT') || 3000;
  const baseUrl = configService.get<string>('BASE_URL') || 
    (nodeEnv === 'production' ? `https://api.gohappygo.fr` : `http://localhost:${port}`);

  // Enable CORS with HTTPS origins
  const allowedOrigins = [
    'http://localhost:4200', // Angular development server
    'http://localhost:3000', // React development server
    'https://gohappygo-back-office.vercel.app', //vercel back-office
    'http://localhost:3000', // Backend server
    'http://127.0.0.1:4200', // Alternative localhost
    'http://127.0.0.1:3000', // Alternative backend
    'https://gohappygo.fr',
    'https://www.gohappygo.fr',
    'https://api.gohappygo.fr',
    'https://gohappygo.netlify.app',
    'http://109.199.107.165:3000', // For colleague
  ];

  // Add production base URL to allowed origins if not already included
  if (!allowedOrigins.includes(baseUrl)) {
    allowedOrigins.push(baseUrl);
  }

  app.enableCors({
    origin: true,//allow all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Access-Control-Allow-Origin',
      'Access-Control-Allow-Headers',
      'Access-Control-Allow-Methods',
    ],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });
  
  //validate incoming request bodies automatically
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, //strips propoerties that don't have decorators
      forbidNonWhitelisted: true,
      transform: true,//automatically transforms payloads to be objects typed according to their classes
      disableErrorMessages: false
    })
  );
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new DbRetryInterceptor()
  )

  // Swagger configuration with HTTPS server URLs
  const config = new DocumentBuilder()
    .setTitle('GoHappyGo API')
    .setDescription('API documentation for GoHappyGo platform - connecting travelers and package senders for collaborative deliveries')
    .setVersion('1.0')
    .addServer(baseUrl, nodeEnv === 'production' ? 'Production server' : 'Development server')
    .addServer('http://localhost:3000', 'Local development')
    .addServer('https://109.199.107.165', 'Production HTTPS server')
    .addServer('http://109.199.107.165:3000', 'Production HTTP server')
    .addTag('auth', 'Authentication endpoints')
    .addTag('airlines', 'Airline management endpoints')
    .addTag('airports', 'Airport management endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('demands', 'Delivery demand endpoints')
    .addTag('demandsAndTravels', 'Demands and travels search endpoints')
    .addTag('travels', 'Travel declaration endpoints')
    .addTag('requests', 'Request matching endpoints')
    .addTag('reviews', 'Review system endpoints')
    .addTag('messages', 'Messaging endpoints')
    .addTag('transactions', 'Payment transaction endpoints')
    .addTag('kyc', 'KYC endpoints')
    .addTag('quotes', 'Quote endpoints')
    .addTag('platform-pricing', 'Platform pricing endpoints')
    .addTag('support', 'Support endpoints')
    .addTag('Stripe', 'Stripe Connect endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for references
    )
    .build();
  
  const document = SwaggerModule.createDocument(app, config,{
    extraModels: [UserEntity, AirlineEntity, TravelEntity, RequestEntity, ReviewEntity, MessageEntity, TransactionEntity, QuoteEntity, PlatformPricingEntity, SupportModule], //add entities to swagger
  });
  
  // Add Stripe tag to Swagger
  document.tags = document.tags || [];
  if (!document.tags.find(t => t.name === 'stripe')) {
    document.tags.push({ name: 'stripe', description: 'Stripe Connect endpoints' });
  }
  
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      // Set the default server
      defaultModelsExpandDepth: 1,
      defaultModelExpandDepth: 1,
      // You can also set the default server here
      url: `${baseUrl}/api-json`, // This will be the default URL for the OpenAPI spec
    },
  });

  // Listen on all interfaces
  await app.listen(port, '0.0.0.0');
  logger.log(`Application is running on: ${baseUrl}`);
  logger.log(`HTTP access: http://109.199.107.165:${port}/api`);
  logger.log(`HTTPS access: https://api.gohappygo.fr/api`);
  logger.log(`Swagger (HTTPS): https://api.gohappygo.fr/api`);
  logger.log(`Swagger (HTTP): http://109.199.107.165:${port}/api`);
}
bootstrap();
