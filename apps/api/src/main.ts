import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import * as cookieParser from "cookie-parser";
import * as express from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  app
    .getHttpAdapter()
    .getInstance()
    .get("/api/health", (_req: express.Request, res: express.Response) => {
      res.json({
        service: "community-api",
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    });
  const uploadDir = resolveUploadRoot();
  fs.mkdirSync(uploadDir, { recursive: true });
  app.use("/uploads", express.static(uploadDir));
  const allowedOrigins = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0) return callback(null, true);
      if (isAllowedOrigin(origin, allowedOrigins)) return callback(null, true);
      return callback(new Error("Origin not allowed by CORS"), false);
    },
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const port = Number(process.env.API_PORT || process.env.PORT || 3001);
  await app.listen(port, "0.0.0.0");
}

bootstrap();

function resolveUploadRoot() {
  const fromCwd = path.resolve(process.cwd(), "uploads");
  const fromWorkspace = path.resolve(process.cwd(), "../../uploads");
  if (fs.existsSync(path.resolve(process.cwd(), ".env"))) return fromCwd;
  return fromWorkspace;
}

function isAllowedOrigin(origin: string, allowList: string[]) {
  if (allowList.includes(origin)) return true;

  for (const rule of allowList) {
    if (!rule.includes("*")) continue;
    const pattern = new RegExp(`^${rule.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`);
    if (pattern.test(origin)) return true;
  }

  if (process.env.ALLOW_NGROK_ORIGINS?.toLowerCase() !== "false") {
    try {
      const parsed = new URL(origin);
      if (parsed.hostname === "localhost") return true;
      if (parsed.hostname === "127.0.0.1") return true;
      if (parsed.hostname === "0.0.0.0") return true;

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      if (siteUrl) {
        const site = new URL(siteUrl);
        if (site.origin === origin) return true;
      }

      if (parsed.hostname.endsWith(".ngrok-free.app")) return true;
      if (parsed.hostname.endsWith(".ngrok-free.dev")) return true;
      if (parsed.hostname.endsWith(".ngrok.io")) return true;
      if (parsed.hostname.endsWith(".ngrok.app")) return true;
    } catch {
      return false;
    }
  }

  return false;
}
