import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { resolveJwtSecret } from "../../common/auth-config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { CaptchaService } from "./captcha.service";
import { EmailValidationService } from "./email-validation.service";
import { GoogleAuthGuard, GoogleCallbackAuthGuard } from "./google-auth.guard";
import { GoogleStrategy } from "./google.strategy";
import { JwtStrategy } from "./jwt.strategy";
import { MailerService } from "./mailer.service";

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: resolveJwtSecret(configService),
        signOptions: { expiresIn: "24h" },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CaptchaService,
    EmailValidationService,
    GoogleAuthGuard,
    GoogleCallbackAuthGuard,
    GoogleStrategy,
    JwtStrategy,
    MailerService,
  ],
  exports: [AuthService, CaptchaService, EmailValidationService, JwtModule, MailerService],
})
export class AuthModule {}
