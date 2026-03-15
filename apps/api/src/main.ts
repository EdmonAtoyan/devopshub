import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import { AppModule } from "./app.module";
import { corsOriginValidator } from "./common/cors";
import { ensureUploadRootExists, resolveUploadRoot } from "./common/uploads";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const httpApp = app.getHttpAdapter().getInstance();
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
  httpApp.get("/api/health", (_req: express.Request, res: express.Response) => {
    res.json({
      service: "community-api",
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });
  const uploadDir = resolveUploadRoot();
  ensureUploadRootExists();
  app.use("/uploads", express.static(uploadDir));

  app.enableCors({
    origin: corsOriginValidator,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  await app.listen(port, "0.0.0.0");
}

bootstrap();
