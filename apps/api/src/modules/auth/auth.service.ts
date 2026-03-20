import { BadRequestException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import bcrypt from "bcryptjs";
import { randomBytes, randomUUID } from "node:crypto";
import {
  hashResetToken,
  shouldLogPasswordResetLink,
} from "../../common/auth-config";
import { PrismaService } from "../../prisma.service";
import { CaptchaService } from "./captcha.service";
import { EmailValidationService } from "./email-validation.service";
import {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResendVerificationDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from "./dto";
import type { GoogleAuthUser } from "./google.strategy";
import { MailerService } from "./mailer.service";
import { resolveSiteUrl } from "./oauth-url";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly captchaService: CaptchaService,
    private readonly emailValidationService: EmailValidationService,
    private readonly mailerService: MailerService,
  ) {}

  async register(dto: RegisterDto, ipAddress?: string) {
    try {
      await this.captchaService.assertToken(dto.captchaToken, ipAddress);

      const email = await this.emailValidationService.normalizeAndValidate(dto.email);
      this.logger.log(`Registration requested for ${email}`);

      const existing = await this.findUserByEmailInsensitive(email, { id: true });
      if (existing) throw new BadRequestException("Email already registered");

      const username = await this.generateUniqueUsername(email);
      const passwordHash = await this.hashPassword(dto.password);
      const user = await this.prisma.user.create({
        data: {
          email,
          username,
          name: dto.name.trim(),
          passwordHash,
        },
        select: { id: true, email: true, username: true, name: true },
      });

      await this.sendVerificationForUserId(user.id);
      this.logger.log(`Registration completed for ${email}; verification email queued`);

      return { success: true, requiresEmailVerification: true };
    } catch (error) {
      if (!(error instanceof BadRequestException)) {
        this.logger.error(
          `Registration crashed for ${dto.email?.trim().toLowerCase() || "unknown-email"}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  async login(dto: LoginDto, ipAddress?: string) {
    const email = dto.email.trim().toLowerCase();

    try {
      await this.captchaService.assertToken(dto.captchaToken, ipAddress);

      this.logger.log(`Login requested for ${email}`);
      const user = await this.findAuthUserByEmail(email);
      if (!user) {
        this.logger.warn(`Login failed for ${email}: user not found`);
        throw new UnauthorizedException("Invalid credentials");
      }

      const valid = await this.verifyPassword(user.passwordHash, dto.password);
      if (!valid) {
        this.logger.warn(`Login failed for ${email}: password verification failed`);
        throw new UnauthorizedException("Invalid credentials");
      }
      if (!user.emailVerifiedAt) {
        this.logger.warn(`Login blocked for ${email}: email not verified`);
        throw new UnauthorizedException("Verify your email before signing in");
      }

      this.logger.log(`Login succeeded for ${email}`);
      return this.issueToken(user.id, user.email);
    } catch (error) {
      if (
        !(error instanceof BadRequestException) &&
        !(error instanceof UnauthorizedException)
      ) {
        this.logger.error(
          `Login crashed for ${email}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
      throw error;
    }
  }

  async loginWithGoogle(profile: GoogleAuthUser) {
    const email = profile.email.trim().toLowerCase();

    try {
      this.logger.log(`Google login requested for ${email}`);

      const existing = await this.findUserByEmailInsensitive(email, {
        id: true,
        email: true,
        avatarUrl: true,
        emailVerifiedAt: true,
      });

      if (existing) {
        const data: { emailVerifiedAt?: Date; avatarUrl?: string } = {};
        if (!existing.emailVerifiedAt) {
          data.emailVerifiedAt = new Date();
        }
        if (!existing.avatarUrl && profile.avatarUrl) {
          data.avatarUrl = profile.avatarUrl;
        }

        if (Object.keys(data).length > 0) {
          await this.prisma.user.update({
            where: { id: existing.id },
            data,
          });
        }

        this.logger.log(`Google login succeeded for existing account ${email}`);
        return this.issueToken(existing.id, existing.email);
      }

      const username = await this.generateUniqueUsername(email);
      const passwordHash = await this.hashPassword(randomBytes(32).toString("hex"));
      const name = profile.name.trim().slice(0, 120) || email.split("@")[0] || "Google user";
      const user = await this.prisma.user.create({
        data: {
          email,
          username,
          name,
          passwordHash,
          avatarUrl: profile.avatarUrl || undefined,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, email: true },
      });

      this.logger.log(`Google login created account for ${email}`);
      return this.issueToken(user.id, user.email);
    } catch (error) {
      this.logger.error(
        `Google login crashed for ${email}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    this.logger.log(`Password reset requested for ${email}`);
    const user = await this.findUserByEmailInsensitive(email, {
      id: true,
      email: true,
      name: true,
    });

    if (!user) {
      this.logger.log(`Password reset request completed for ${email}: no matching account`);
      return { success: true };
    }

    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
    const token = randomBytes(32).toString("hex");
    const resetLink = await this.persistPasswordResetToken(user.id, token);
    await this.sendPasswordResetEmail({
      email: user.email,
      name: user.name,
      resetLink,
    });
    this.logger.log(`Password reset email queued for ${user.email}`);

    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = dto.token.trim();
    const tokenHash = hashResetToken(token);
    const record = await this.prisma.passwordResetToken.findFirst({
      where: {
        OR: [{ token: tokenHash }, { token }],
      },
      select: { id: true, userId: true, expiresAt: true },
    });

    if (!record || record.expiresAt.getTime() < Date.now()) {
      this.logger.warn("Password reset failed: invalid or expired token");
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await this.hashPassword(dto.password);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.delete({ where: { id: record.id } });
    });

    this.logger.log(`Password reset completed for user ${record.userId}`);
    return { success: true };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const token = dto.token.trim();
    const tokenHash = hashResetToken(token);
    const [record] = await this.prisma.$queryRaw<Array<{ id: string; userId: string; expiresAt: Date }>>`
      SELECT "id", "userId", "expiresAt"
      FROM "EmailVerificationToken"
      WHERE "token" = ${tokenHash} OR "token" = ${token}
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;

    if (!record || record.expiresAt.getTime() < Date.now()) {
      this.logger.warn("Email verification failed: invalid or expired token");
      throw new BadRequestException("Invalid or expired verification link");
    }

    await this.prisma.$transaction(async (tx: any) => {
      await tx.$executeRaw`
        UPDATE "User"
        SET "emailVerifiedAt" = ${new Date()}
        WHERE "id" = ${record.userId}
      `;
      await tx.$executeRaw`
        DELETE FROM "EmailVerificationToken"
        WHERE "userId" = ${record.userId}
      `;
    });

    this.logger.log(`Email verification completed for user ${record.userId}`);
    return { success: true };
  }

  async resendVerification(dto: ResendVerificationDto, ipAddress?: string) {
    await this.captchaService.assertToken(dto.captchaToken, ipAddress);

    const email = await this.emailValidationService.normalizeAndValidate(dto.email);
    this.logger.log(`Verification resend requested for ${email}`);
    const user = await this.findUserByEmailInsensitive(email, {
      id: true,
      email: true,
      name: true,
      emailVerifiedAt: true,
    });

    if (!user || user.emailVerifiedAt) {
      this.logger.log(`Verification resend completed for ${email}: no pending verification`);
      return { success: true };
    }

    await this.sendVerificationForUserId(user.id);
    this.logger.log(`Verification email queued for ${user.email}`);
    return { success: true };
  }

  me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        showGifs: true,
        verified: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  async sendVerificationForUserId(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });

    if (!user) {
      this.logger.warn(`Verification email skipped: user ${userId} not found`);
      return;
    }

    await this.sendEmailVerification(user);
  }

  private issueToken(userId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email });
    return { accessToken };
  }

  private async sendEmailVerification(user: { id: string; email: string; name: string }) {
    await this.prisma.$executeRaw`
      DELETE FROM "EmailVerificationToken"
      WHERE "userId" = ${user.id}
    `;

    const token = randomBytes(32).toString("hex");
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24);

    await this.prisma.$executeRaw`
      INSERT INTO "EmailVerificationToken" ("id", "userId", "token", "expiresAt", "createdAt")
      VALUES (${randomUUID()}, ${user.id}, ${tokenHash}, ${expiresAt}, ${new Date()})
    `;
    this.logger.log(`Stored email verification token for user ${user.id}`);

    const verificationLink = this.buildActionUrl(
      process.env.EMAIL_VERIFICATION_BASE_URL?.trim() ||
        resolveSiteUrl(),
      `/verify-email?token=${token}`,
    );

    if (shouldLogPasswordResetLink()) {
      this.logger.log(`[email-verification] ${user.email} -> ${verificationLink}`);
    }

    await this.mailerService.sendMail({
      to: user.email,
      subject: "Verify your DevOps Hub email",
      text: [
        `Hi ${user.name},`,
        "",
        "Verify your email address to activate your account.",
        verificationLink,
        "",
        "This verification link expires in 24 hours.",
      ].join("\n"),
      html: this.renderActionEmail({
        preview: "Verify your DevOps Hub email",
        heading: "Verify your email address",
        greeting: `Hi ${user.name},`,
        intro: "Welcome to DevOps Hub. Confirm your email address to activate your account and complete sign in.",
        ctaLabel: "Verify email",
        ctaUrl: verificationLink,
        expiry: "This verification link expires in 24 hours.",
        footer: "If you did not create this account, you can ignore this email.",
      }),
    });
  }

  private async persistPasswordResetToken(userId: string, token: string) {
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.passwordResetToken.create({
      data: {
        id: randomUUID(),
        userId,
        token: tokenHash,
        expiresAt,
      },
    });
    this.logger.log(`Stored password reset token for user ${userId}`);

    return this.buildActionUrl(
      process.env.RESET_PASSWORD_BASE_URL?.trim() ||
        resolveSiteUrl(),
      `/reset-password?token=${token}`,
    );
  }

  private async sendPasswordResetEmail(input: { email: string; name: string; resetLink: string }) {
    if (shouldLogPasswordResetLink()) {
      this.logger.log(`[password-reset] ${input.email} -> ${input.resetLink}`);
    }

    await this.mailerService.sendMail({
      to: input.email,
      subject: "Reset your DevOps Hub password",
      text: [
        `Hi ${input.name},`,
        "",
        "Use the link below to reset your password.",
        input.resetLink,
        "",
        "This reset link expires in 1 hour.",
      ].join("\n"),
      html: this.renderActionEmail({
        preview: "Reset your DevOps Hub password",
        heading: "Reset your password",
        greeting: `Hi ${input.name},`,
        intro: "We received a request to reset your DevOps Hub password. Use the secure link below to choose a new one.",
        ctaLabel: "Reset password",
        ctaUrl: input.resetLink,
        expiry: "This reset link expires in 1 hour.",
        footer: "If you did not request a password reset, you can ignore this email and your password will stay unchanged.",
      }),
    });
  }

  private buildActionUrl(baseUrl: string, path: string) {
    return `${baseUrl.replace(/\/+$/, "")}${path}`;
  }

  private async findAuthUserByEmail(email: string) {
    return this.findUserByEmailInsensitive(email, {
      id: true,
      email: true,
      passwordHash: true,
      emailVerifiedAt: true,
    });
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  private renderActionEmail(input: {
    preview: string;
    heading: string;
    greeting: string;
    intro: string;
    ctaLabel: string;
    ctaUrl: string;
    expiry: string;
    footer: string;
  }) {
    const preview = this.escapeHtml(input.preview);
    const heading = this.escapeHtml(input.heading);
    const greeting = this.escapeHtml(input.greeting);
    const intro = this.escapeHtml(input.intro);
    const ctaLabel = this.escapeHtml(input.ctaLabel);
    const ctaUrl = this.escapeHtml(input.ctaUrl);
    const expiry = this.escapeHtml(input.expiry);
    const footer = this.escapeHtml(input.footer);

    return [
      "<!doctype html>",
      '<html lang="en">',
      "  <body style=\"margin:0;background:#0f172a;font-family:Arial,sans-serif;color:#e5e7eb;\">",
      `    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preview}</div>`,
      '    <div style="padding:32px 16px;">',
      '      <div style="margin:0 auto;max-width:560px;border:1px solid rgba(148,163,184,0.2);border-radius:24px;background:#111827;overflow:hidden;">',
      '        <div style="padding:28px 32px;background:linear-gradient(135deg,#0f172a 0%,#111827 55%,#1f2937 100%);border-bottom:1px solid rgba(148,163,184,0.18);">',
      '          <p style="margin:0 0 10px;font-size:12px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#86efac;">DevOps Hub</p>',
      `          <h1 style="margin:0;font-size:28px;line-height:1.2;color:#f8fafc;">${heading}</h1>`,
      "        </div>",
      '        <div style="padding:32px;">',
      `          <p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#f8fafc;">${greeting}</p>`,
      `          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#cbd5e1;">${intro}</p>`,
      '          <div style="margin:0 0 24px;">',
      `            <a href="${ctaUrl}" style="display:inline-block;padding:14px 22px;border-radius:999px;background:#86efac;color:#052e16;font-size:14px;font-weight:700;text-decoration:none;">${ctaLabel}</a>`,
      "          </div>",
      `          <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#94a3b8;">${expiry}</p>`,
      `          <p style="margin:0 0 18px;font-size:13px;line-height:1.7;color:#94a3b8;">${footer}</p>`,
      `          <p style="margin:0;font-size:12px;line-height:1.7;color:#64748b;">If the button does not work, copy and paste this link into your browser:<br><span style="color:#cbd5e1;">${ctaUrl}</span></p>`,
      "        </div>",
      "      </div>",
      "    </div>",
      "  </body>",
      "</html>",
    ].join("");
  }

  private async hashPassword(password: string) {
    return argon2.hash(password);
  }

  private async verifyPassword(hash: string, password: string) {
    try {
      if (/^\$2[aby]\$\d{2}\$/.test(hash)) {
        return bcrypt.compare(password, hash);
      }

      return argon2.verify(hash, password);
    } catch (error) {
      this.logger.error(
        `Password verification crashed for hash prefix ${hash.slice(0, 12)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return false;
    }
  }

  private findUserByEmailInsensitive<T extends Record<string, boolean>>(email: string, select: T) {
    return this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive",
        },
      },
      orderBy: { createdAt: "asc" },
      select: select as any,
    });
  }

  private async generateUniqueUsername(email: string) {
    const localPart = email.split("@")[0] ?? "user";
    const base =
      localPart
        .toLowerCase()
        .replace(/[^a-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^[-._]+|[-._]+$/g, "")
        .slice(0, 24) || "user";

    let candidate = base;
    let suffix = 1;

    while (true) {
      const exists = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!exists) return candidate;
      suffix += 1;
      const suffixLabel = `-${suffix}`;
      candidate = `${base.slice(0, Math.max(1, 30 - suffixLabel.length))}${suffixLabel}`;
    }
  }
}
