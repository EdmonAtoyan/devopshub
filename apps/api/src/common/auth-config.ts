import { ConfigService } from "@nestjs/config";
import { createHash } from "node:crypto";

const DEFAULT_JWT_SECRET_PLACEHOLDER = "replace-me";

export function resolveJwtSecret(configService?: ConfigService) {
  const configured =
    configService?.get<string>("JWT_SECRET")?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "";

  if (configured && configured !== DEFAULT_JWT_SECRET_PLACEHOLDER) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be explicitly configured in production");
  }

  return createHash("sha256")
    .update(`${process.cwd()}:devops-community-platform:local-jwt`)
    .digest("hex");
}

export function hashResetToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function shouldLogPasswordResetLink() {
  const configured = process.env.LOG_PASSWORD_RESET_LINKS?.trim().toLowerCase();
  if (configured === "true" || configured === "1") return true;
  if (configured === "false" || configured === "0") return false;
  return process.env.NODE_ENV !== "production";
}
