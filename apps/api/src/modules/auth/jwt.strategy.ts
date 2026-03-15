import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { resolveJwtSecret } from "../../common/auth-config";
import { PrismaService } from "../../prisma.service";

type JwtPayload = {
  sub: string;
  email: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: { cookies?: Record<string, string> }) => request?.cookies?.access_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(configService),
    });
  }

  async validate(payload: JwtPayload) {
    const [user] = await this.prisma.$queryRaw<Array<{ id: string; email: string; emailVerifiedAt: Date | null }>>`
      SELECT "id", "email", "emailVerifiedAt"
      FROM "User"
      WHERE "id" = ${payload.sub}
      LIMIT 1
    `;

    if (!user || !user.emailVerifiedAt) {
      throw new UnauthorizedException("Email verification required");
    }

    return { userId: user.id, email: user.email };
  }
}
