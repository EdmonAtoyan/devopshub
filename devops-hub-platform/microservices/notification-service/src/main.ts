import { Controller, Get, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { collectDefaultMetrics, register } from 'prom-client';
import { startTelemetry } from './telemetry';

dotenv.config();

@Controller('notifications')
class AppController {
  @Get()
  index() {
    return { service: 'notification-service', status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  health() {
    return { service: 'notification-service', status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('metrics')
  async metrics() {
    return register.metrics();
  }
}

@Module({
  controllers: [AppController],
})
class AppModule {}

async function bootstrap() {
  const serviceName = process.env.SERVICE_NAME ?? 'notification-service';
  await startTelemetry(serviceName);

  const metricPrefix = `${serviceName.replace(/-/g, '_')}_`;
  collectDefaultMetrics({ prefix: metricPrefix });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger(serviceName);
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  logger.log(`Service ${serviceName} listening on ${port}`);
}

bootstrap();
