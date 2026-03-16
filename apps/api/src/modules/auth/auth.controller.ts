import { Body, Controller, Get, Post, Req, Res, UnauthorizedException, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { authCookieClearOptions, authCookieOptions } from "../../common/auth-cookie";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { AuthService } from "./auth.service";
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto";
import { GoogleCallbackAuthGuard, GoogleAuthGuard } from "./google-auth.guard";
import type { GoogleAuthUser } from "./google.strategy";
import { buildClientUrl } from "./oauth-url";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("register")
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, this.resolveRequestIp(req));
  }

  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto, this.resolveRequestIp(req));
    res.cookie("access_token", session.accessToken, authCookieOptions(req));
    return { success: true };
  }

  @Get("google")
  @UseGuards(GoogleAuthGuard)
  googleAuth() {}

  @Get("google/callback")
  @UseGuards(GoogleCallbackAuthGuard)
  async googleAuthCallback(
    @Req() req: Request & { user?: GoogleAuthUser },
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!req.user) {
      throw new UnauthorizedException("Google authentication failed");
    }

    const session = await this.authService.loginWithGoogle(req.user);
    res.cookie("access_token", session.accessToken, authCookieOptions(req));

    if (this.wantsJson(req)) {
      return {
        success: true,
        accessToken: session.accessToken,
      };
    }

    res.redirect(302, buildClientUrl("/feed"));
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: { userId: string }) {
    return this.authService.me(user.userId);
  }

  @Post("logout")
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    res.clearCookie("access_token", authCookieClearOptions(req));
    return { success: true };
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("verify-email")
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("resend-verification")
  resendVerification(@Body() dto: ResendVerificationDto, @Req() req: Request) {
    return this.authService.resendVerification(dto, this.resolveRequestIp(req));
  }

  private resolveRequestIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0]?.trim() || req.ip;
    }
    return req.ip;
  }

  private wantsJson(req: Request) {
    const rawFormat = req.query.format;
    const format = typeof rawFormat === "string" ? rawFormat.trim().toLowerCase() : "";
    if (format === "json") return true;
    return req.accepts(["html", "json"]) === "json";
  }
}
