import { Controller, Get, Header, Logger, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as dotenv from 'dotenv';
import { collectDefaultMetrics, register } from 'prom-client';
import { startTelemetry } from './telemetry';

dotenv.config();

@Controller()
class LandingController {
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  index() {
    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DevOps Hub Platform</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 0; background: #0b1220; color: #e2e8f0; }
      main { max-width: 760px; margin: 0 auto; padding: 48px 20px 64px; }
      h1 { font-size: 2rem; margin-bottom: 0.5rem; }
      p { color: #94a3b8; line-height: 1.6; }
      ul { padding-left: 1.25rem; }
      a { color: #38bdf8; text-decoration: none; }
      a:hover { text-decoration: underline; }
      .card { background: #111827; border: 1px solid #1e293b; border-radius: 16px; padding: 20px; margin-top: 24px; }
      code { color: #f8fafc; }
    </style>
  </head>
  <body>
    <main>
      <h1>DevOps Hub Platform</h1>
      <p>The public gateway is live. This service exposes health and internal platform routes for the deployed microservices.</p>
      <div class="card">
        <strong>Available routes</strong>
        <ul>
          <li><a href="/api">/api</a></li>
          <li><a href="/api/health">/api/health</a></li>
          <li><a href="/auth/health">/auth/health</a></li>
          <li><a href="/profiles/health">/profiles/health</a></li>
          <li><a href="/notifications/health">/notifications/health</a></li>
          <li><a href="/media/health">/media/health</a></li>
        </ul>
      </div>
    </main>
  </body>
</html>`;
  }
}

@Controller('api')
class ApiGatewayController {
  @Get()
  index() {
    return {
      service: 'api-gateway',
      status: 'ok',
      routes: ['/api/health', '/api/metrics', '/auth/health', '/profiles/health', '/notifications/health', '/media/health'],
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  health() {
    return { service: 'api-gateway', status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('metrics')
  async metrics() {
    return register.metrics();
  }
}

@Module({
  controllers: [LandingController, ApiGatewayController],
})
class AppModule {}

const upstreamRoutes = [
  {
    prefix: '/api',
    target: process.env.COMMUNITY_API_URL ?? 'http://community-api.devops-hub.svc.cluster.local',
    exclude: new Set(['/api', '/api/health', '/api/metrics']),
  },
  {
    prefix: '/auth',
    target: process.env.AUTH_SERVICE_URL ?? 'http://auth-service.devops-hub.svc.cluster.local',
    exclude: new Set<string>(),
  },
  {
    prefix: '/profiles',
    target: process.env.PROFILE_SERVICE_URL ?? 'http://profile-service.devops-hub.svc.cluster.local',
    exclude: new Set<string>(),
  },
  {
    prefix: '/notifications',
    target: process.env.NOTIFICATION_SERVICE_URL ?? 'http://notification-service.devops-hub.svc.cluster.local',
    exclude: new Set<string>(),
  },
  {
    prefix: '/media',
    target: process.env.MEDIA_SERVICE_URL ?? 'http://media-service.devops-hub.svc.cluster.local',
    exclude: new Set<string>(),
  },
];

function resolveUpstream(requestUrl: string) {
  const pathname = requestUrl.split('?')[0];
  return upstreamRoutes.find(({ prefix, exclude }) => {
    if (exclude.has(pathname)) {
      return false;
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

async function readRequestBody(req: any) {
  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return Buffer.from(JSON.stringify(req.body));
  }

  if (typeof req.body === 'string') {
    return Buffer.from(req.body);
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return undefined;
  }

  return Buffer.concat(chunks);
}

async function bootstrap() {
  const serviceName = process.env.SERVICE_NAME ?? 'api-gateway';
  await startTelemetry(serviceName);

  const metricPrefix = `${serviceName.replace(/-/g, '_')}_`;
  collectDefaultMetrics({ prefix: metricPrefix });

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = new Logger(serviceName);
  const port = Number(process.env.PORT ?? 3000);
  const httpAdapter = app.getHttpAdapter().getInstance() as any;

  httpAdapter.use(async (req: any, res: any, next: () => void) => {
    const requestUrl = req.originalUrl ?? req.url;
    const upstream = resolveUpstream(requestUrl);

    if (!upstream) {
      next();
      return;
    }

    try {
      const targetUrl = new URL(requestUrl, upstream.target);
      const headers = new Headers();

      for (const [name, rawValue] of Object.entries(req.headers)) {
        if (!rawValue || ['host', 'connection', 'content-length'].includes(name)) {
          continue;
        }

        const headerValue = Array.isArray(rawValue) ? rawValue.join(',') : String(rawValue);
        headers.set(name, headerValue);
      }

      headers.set('x-forwarded-host', req.headers.host ?? '');
      headers.set('x-forwarded-proto', req.protocol ?? 'http');

      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readRequestBody(req);
      const upstreamResponse = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
        redirect: 'manual',
      });

      res.status(upstreamResponse.status);
      upstreamResponse.headers.forEach((value, name) => {
        if (name === 'transfer-encoding') {
          return;
        }

        res.setHeader(name, value);
      });

      const payload = Buffer.from(await upstreamResponse.arrayBuffer());
      res.send(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown upstream error';
      logger.error(`Proxy request failed for ${requestUrl}: ${message}`);
      res.status(502).json({
        service: serviceName,
        status: 'error',
        message: 'Upstream service is unavailable',
        upstream: upstream.prefix,
        timestamp: new Date().toISOString(),
      });
    }
  });

  await app.listen(port);
  logger.log(`Service ${serviceName} listening on ${port}`);
}

bootstrap();
