import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import { AppModule } from "./app.module";
import { corsOriginValidator } from "./common/cors";
import { ensureUploadRootExists, resolveUploadRoot } from "./common/uploads";

function resolveListenPort(...candidates: Array<string | undefined>) {
  for (const candidate of candidates) {
    const value = candidate?.trim();
    if (!value || !/^\d+$/.test(value)) continue;

    const port = Number(value);
    if (Number.isInteger(port) && port > 0 && port <= 65535) {
      return port;
    }
  }

  return 4000;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpApp = app.getHttpAdapter().getInstance();

  httpApp.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const directApiPrefixes = ["/auth", "/users", "/posts"];
    const shouldAlias = directApiPrefixes.some(
      (prefix) => req.path === prefix || req.path.startsWith(`${prefix}/`),
    );

    if (shouldAlias) {
      req.url = `/api${req.url}`;
    }

    next();
  });

  app.setGlobalPrefix("api");
  app.enableShutdownHooks();
  httpApp.disable("x-powered-by");
  app.use(cookieParser());
  app.use((_req: express.Request, res: express.Response, next: express.NextFunction) => {
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });
  const healthHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      service: "community-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  };

  httpApp.get("/health", healthHandler);
  httpApp.get("/api/health", healthHandler);
  const uploadDir = resolveUploadRoot();
  ensureUploadRootExists();
  app.use("/uploads", express.static(uploadDir));

  app.enableCors({
    origin: corsOriginValidator,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = resolveListenPort(
    process.env.PORT,
    process.env.API_INTERNAL_PORT,
    process.env.API_PORT,
  );
  await app.listen(port, "0.0.0.0");
}

bootstrap();
