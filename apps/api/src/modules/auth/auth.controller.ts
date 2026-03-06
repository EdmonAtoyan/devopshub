import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Request, Response } from "express";
import { authCookieClearOptions, authCookieOptions } from "../../common/auth-cookie";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { AuthService } from "./auth.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./dto";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  async register(@Body() dto: RegisterDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.register(dto);
    res.cookie("access_token", session.accessToken, authCookieOptions(req));
    return { success: true };
  }

  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.authService.login(dto);
    res.cookie("access_token", session.accessToken, authCookieOptions(req));
    return { success: true };
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

  @Post("forgot-password")
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post("reset-password")
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }
}
