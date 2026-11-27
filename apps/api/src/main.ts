import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import type { AppEnv } from './config/env.validation';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');
  const configService = app.get<ConfigService<AppEnv, true>>(ConfigService);

  const port = configService.get('API_PORT', { infer: true });
  const prefix = configService.get('API_PREFIX', { infer: true });
  const corsOrigin = configService.get('CORS_ORIGIN', { infer: true });
  const nodeEnv = configService.get('NODE_ENV', { infer: true });
  const trustProxy = configService.get('TRUST_PROXY', { infer: true });

  if (trustProxy) {
    (app.getHttpAdapter().getInstance() as { set: (key: string, value: unknown) => void }).set(
      'trust proxy',
      1,
    );
  }

  app.setGlobalPrefix(prefix);
  app.enableShutdownHooks();

  app.enableCors({
    origin: corsOrigin.split(',').map((item) => item.trim()),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Home Ledger API')
      .setDescription('家庭财务管理系统后端接口文档')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }

  await app.listen(port);
  logger.log(`API server running at http://localhost:${port}/${prefix}`);
}

void bootstrap();
