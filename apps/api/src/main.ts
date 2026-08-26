import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('IRONLOOM:Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);
  const apiPrefix = configService.get<string>('apiPrefix', 'api/v1');

  app.setGlobalPrefix(apiPrefix);
  app.enableCors({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(port);
  logger.log(`=======================================================`);
  logger.log(`  IRONLOOM AI OS API running at http://localhost:${port}/${apiPrefix}`);
  logger.log(`  AI Gateway endpoint: POST http://localhost:${port}/${apiPrefix}/gateway/complete`);
  logger.log(`=======================================================`);
}

bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
