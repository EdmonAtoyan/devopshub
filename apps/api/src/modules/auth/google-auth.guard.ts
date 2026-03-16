import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { buildClientUrl } from "./oauth-url";

@Injectable()
export class GoogleAuthGuard extends AuthGuard("google") {
  getAuthenticateOptions() {
    return {
      scope: ["email", "profile"],
      prompt: "select_account",
      session: false,
    };
  }
}

@Injectable()
export class GoogleCallbackAuthGuard extends AuthGuard("google") {
  getAuthenticateOptions() {
    return {
      failureRedirect: buildClientUrl("/login?oauthError=google"),
      session: false,
    };
  }
}
