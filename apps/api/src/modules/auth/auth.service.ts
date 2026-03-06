import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { randomBytes, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma.service";
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto } from "./dto";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
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

    return this.issueToken(user.id, user.email);
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await this.verifyPassword(user.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.issueToken(user.id, user.email);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (!user) return { success: true };

    const token = randomBytes(32).toString("hex");
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await this.prisma.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "userId" = ${user.id}`;
    await this.prisma.$executeRaw`
      INSERT INTO "PasswordResetToken" ("id", "userId", "token", "expiresAt", "createdAt")
      VALUES (${id}, ${user.id}, ${token}, ${expiresAt}, NOW())
    `;

    const baseUrl =
      process.env.RESET_PASSWORD_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      "http://localhost:3000";
    const resetLink = `${baseUrl.replace(/\/+$/, "")}/reset-password?token=${token}`;

    // Placeholder mail transport: output the link for local/dev environments.
    console.log(`[password-reset] ${email} -> ${resetLink}`);
    return { success: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const token = dto.token.trim();
    const rows = await this.prisma.$queryRaw<Array<{ id: string; userId: string; expiresAt: Date }>>`
      SELECT "id", "userId", "expiresAt"
      FROM "PasswordResetToken"
      WHERE "token" = ${token}
      LIMIT 1
    `;
    const record = rows[0];

    if (!record || record.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Invalid or expired reset token");
    }

    const passwordHash = await this.hashPassword(dto.password);

    await this.prisma.$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
      await tx.$executeRaw`DELETE FROM "PasswordResetToken" WHERE "id" = ${record.id}`;
    });

    return { success: true };
  }

  me(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  private issueToken(userId: string, email: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email });
    return { accessToken };
  }

  private async hashPassword(password: string) {
    const bcrypt = await this.tryLoadBcrypt();
    if (bcrypt) return bcrypt.hash(password, 10);
    return argon2.hash(password);
  }

  private async verifyPassword(hash: string, password: string) {
    const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(hash);
    if (isBcryptHash) {
      const bcrypt = await this.tryLoadBcrypt();
      if (!bcrypt) return false;
      return bcrypt.compare(password, hash);
    }
    return argon2.verify(hash, password);
  }

  private async tryLoadBcrypt() {
    try {
      const req = eval("require");
      return req("bcryptjs");
    } catch {
      return null;
    }
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
      candidate = `${base}-${suffix}`.slice(0, 30);
    }
  }
}
