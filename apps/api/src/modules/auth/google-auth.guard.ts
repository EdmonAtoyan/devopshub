import { ExecutionContext, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { buildClientUrl, isGoogleOAuthConfigured } from "./oauth-url";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  private readonly logger = new Logger(GoogleAuthGuard.name);

  async canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured()) {
      this.handleMissingConfig(context);
      return false;
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions() {
    return {
      scope: ["email", "profile"],
      prompt: "select_account",
      session: false,
    };
  }

  private handleMissingConfig(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    this.logger.warn("Google OAuth is not configured; refusing sign-in request");
    if (request.accepts(["html", "json"]) === "json") {
      response.status(503).json({ message: "Google sign-in is not configured" });
      return;
    }

    response.redirect(302, buildClientUrl("/login?oauthError=google_config"));
  }
}

@Injectable()
export class GoogleCallbackAuthGuard extends AuthGuard("google") {
  private readonly logger = new Logger(GoogleCallbackAuthGuard.name);

  async canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured()) {
      this.handleMissingConfig(context);
      return false;
    }

    try {
      return (await super.canActivate(context)) as boolean;
    } catch (error) {
      this.handleFailure(context, error);
      return false;
    }
  }

  getAuthenticateOptions() {
    return {
      session: false,
    };
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser, info: unknown) {
    if (err) {
      throw err;
    }

    if (!user) {
      throw new UnauthorizedException(this.extractMessage(info) || "Google authentication failed");
    }

    return user;
  }

  private handleMissingConfig(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    this.logger.warn("Google OAuth callback received, but OAuth is not configured");
    if (request.accepts(["html", "json"]) === "json") {
      response.status(503).json({ message: "Google sign-in is not configured" });
      return;
    }

    response.redirect(302, buildClientUrl("/login?oauthError=google_config"));
  }

  private handleFailure(context: ExecutionContext, error: unknown) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { code, message } = this.resolveFailure(error, request);

    this.logger.warn(`Google OAuth callback failed (${code}): ${message}`);

    if (request.accepts(["html", "json"]) === "json") {
      response.status(401).json({ message });
      return;
    }

    response.redirect(302, buildClientUrl(`/login?oauthError=${code}`));
  }

  private resolveFailure(error: unknown, request: Request) {
    const rawError = request.query.error;
    const oauthError = typeof rawError === "string" ? rawError.trim().toLowerCase() : "";
    if (oauthError === "access_denied") {
      return {
        code: "google_cancelled",
        message: "Google sign-in was cancelled before it completed",
      };
    }

    const message = this.extractMessage(error) || "Google authentication failed";
    if (/did not provide an email address/i.test(message)) {
      return {
        code: "google_no_email",
        message,
      };
    }

    return {
      code: "google",
      message,
    };
  }

  private extractMessage(value: unknown) {
    if (!value) return "";
    if (typeof value === "string") return value.trim();
    if (value instanceof Error) return value.message.trim();
    if (typeof value === "object" && "message" in value) {
      const message = (value as { message?: unknown }).message;
      if (typeof message === "string") return message.trim();
    }
    return "";
  }
}
