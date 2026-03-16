import { ExecutionContext, Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import type { Request, Response } from "express";
import { buildClientUrl, isGoogleOAuthConfigured } from "./oauth-url";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
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
    if (request.accepts(["html", "json"]) === "json") {
      response.status(503).json({ message: "Google sign-in is not configured" });
      return;
    }

    response.redirect(302, buildClientUrl("/login?oauthError=google"));
  }
}

@Injectable()
export class GoogleCallbackAuthGuard extends AuthGuard("google") {
  async canActivate(context: ExecutionContext) {
    if (!isGoogleOAuthConfigured()) {
      this.handleMissingConfig(context);
      return false;
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions() {
    return {
      failureRedirect: buildClientUrl("/login?oauthError=google"),
      session: false,
    };
  }

  private handleMissingConfig(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    if (request.accepts(["html", "json"]) === "json") {
      response.status(503).json({ message: "Google sign-in is not configured" });
      return;
    }

    response.redirect(302, buildClientUrl("/login?oauthError=google"));
  }
}
