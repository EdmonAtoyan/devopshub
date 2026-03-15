import {
  BadRequestException,
  Body,
  Controller,
  Query,
  Req,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { authCookieClearOptions } from "../../common/auth-cookie";
import {
  createUploadFilename,
  ensureAvatarUploadDirExists,
  resolveAvatarExtension,
  resolveAvatarUploadDir,
} from "../../common/uploads";
import { toNotificationDto } from "../../common/notifications";
import { clampInt } from "../../common/query";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { OptionalJwtAuthGuard } from "../../common/optional-jwt-auth.guard";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../prisma.service";
import { AuthService } from "../auth/auth.service";
import { CaptchaService } from "../auth/captcha.service";
import { EmailValidationService } from "../auth/email-validation.service";
import { buildPostInclude, enrichPosts } from "../feed/post-query";
import { UpdateProfileDto, VerifyAccountDto } from "./dto";

const { diskStorage } = require("multer");

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly emailValidationService: EmailValidationService,
  ) {}

  @Get(":username")
  async getByUsername(@Param("username") username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        verified: true,
        name: true,
        bio: true,
        avatarUrl: true,
        specialties: true,
        reputation: true,
        githubUrl: true,
        gitlabUrl: true,
        linkedinUrl: true,
        websiteUrl: true,
      },
    });

    if (!user) return null;

    const [postsCount, followersCount, followingCount, articlesCount, snippetsCount] = await Promise.all([
      this.prisma.post.count({ where: { authorId: user.id } }),
      this.prisma.follow.count({ where: { followeeId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      this.prisma.article.count({ where: { authorId: user.id } }),
      this.prisma.snippet.count({ where: { authorId: user.id } }),
    ]);

    return {
      ...user,
      stats: {
        posts: postsCount,
        followers: followersCount,
        following: followingCount,
        articles: articlesCount,
        snippets: snippetsCount,
      },
    };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(":username/posts")
  async getPostsByUsername(
    @Param("username") username: string,
    @Query("limit") limit = "12",
    @Query("commentLimit") commentLimit = "0",
    @CurrentUser() currentUser: { userId: string } | null = null,
  ) {
    const safeLimit = clampInt(limit, 1, 30, 12);
    const safeCommentLimit = clampInt(commentLimit, 0, 20, 0);
    const profileUser = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!profileUser) return [];

    const posts = await this.prisma.post.findMany({
      where: { authorId: profileUser.id },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      include: buildPostInclude(safeCommentLimit),
    });

    return enrichPosts(
      this.prisma,
      posts as Array<Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }>,
      safeCommentLimit,
      currentUser?.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/profile")
  me(@CurrentUser() user: { userId: string }) {
    return this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        verified: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get("me/bookmarks")
  async getSavedPosts(
    @CurrentUser() user: { userId: string },
    @Query("limit") limit = "30",
  ) {
    const safeLimit = clampInt(limit, 1, 50, 30);
    const entries = await this.prisma.postBookmark.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
      include: {
        post: {
          include: buildPostInclude(4),
        },
      },
    });

    const enrichedPosts = await enrichPosts(
      this.prisma,
      entries.map((entry: { post: Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } } }) => entry.post),
      4,
      user.userId,
    );

    return entries.map((entry: { createdAt: Date }, index: number) => ({
      savedAt: entry.createdAt,
      post: enrichedPosts[index],
    }));
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/profile")
  async updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data: {
      username?: string;
      email?: string;
      bio?: string;
    } = {};
    const currentUser = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { email: true },
    });
    let emailChanged = false;

    if (dto.username !== undefined) {
      const username = dto.username.trim().toLowerCase();
      if (username.length < 2) throw new BadRequestException("Username too short");

      const existing = await this.prisma.user.findUnique({
        where: { username },
        select: { id: true },
      });
      if (existing && existing.id !== user.userId) {
        throw new BadRequestException("Username already taken");
      }
      data.username = username;
    }

    if (dto.email !== undefined) {
      const email = await this.emailValidationService.normalizeAndValidate(dto.email);
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== user.userId) {
        throw new BadRequestException("Email already in use");
      }

      if (email !== currentUser?.email) {
        data.email = email;
        emailChanged = true;
      }
    }

    if (dto.bio !== undefined) data.bio = dto.bio.trim();

    const updated = await this.prisma.user.update({
      where: { id: user.userId },
      data,
      select: {
        id: true,
        username: true,
        verified: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });

    if (emailChanged) {
      await this.prisma.$executeRaw`
        UPDATE "User"
        SET "emailVerifiedAt" = NULL
        WHERE "id" = ${updated.id}
      `;
      await this.authService.sendVerificationForUserId(updated.id);
      res.clearCookie("access_token", authCookieClearOptions(req));
      return { ...updated, requiresEmailVerification: true };
    }

    return updated;
  }

  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post("me/verification")
  async verifyMyAccount(
    @CurrentUser() user: { userId: string },
    @Body() dto: VerifyAccountDto,
    @Req() req: Request,
  ) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { id: true, verified: true },
    });

    if (!account) {
      throw new BadRequestException("User not found");
    }

    if (account.verified) {
      return { verified: true };
    }

    await this.captchaService.assertToken(dto.captchaToken, this.resolveRequestIp(req));

    return this.prisma.user.update({
      where: { id: user.userId },
      data: { verified: true },
      select: { verified: true },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: (_req: unknown, _file: unknown, cb: (error: Error | null, destination: string) => void) => {
          ensureAvatarUploadDirExists();
          cb(null, resolveAvatarUploadDir());
        },
        filename: (
          _req: unknown,
          file: { mimetype: string },
          cb: (error: Error | null, filename: string) => void,
        ) => {
          cb(null, createUploadFilename(resolveAvatarExtension(file.mimetype)));
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (
        _req: unknown,
        file: { mimetype: string },
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        if (file.mimetype.startsWith("image/")) cb(null, true);
        else cb(new BadRequestException("Avatar must be an image"), false);
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser() user: { userId: string },
    @UploadedFile() file?: { filename?: string },
  ) {
    if (!file?.filename) throw new BadRequestException("No file uploaded");

    const avatarUrl = `/uploads/avatars/${file.filename}`;
    return this.prisma.user.update({
      where: { id: user.userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        verified: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete("me/account")
  async deleteMyAccount(
    @CurrentUser() user: { userId: string },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.prisma.user.delete({ where: { id: user.userId } });
    res.clearCookie("access_token", authCookieClearOptions(req));
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get(":id/following")
  async getFollowState(@Param("id") followeeId: string, @CurrentUser() user: { userId: string }) {
    if (user.userId === followeeId) return { following: false };

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: user.userId, followeeId } },
    });

    return { following: !!existing };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/follow")
  async toggleFollow(@Param("id") followeeId: string, @CurrentUser() user: { userId: string }) {
    if (user.userId === followeeId) return { following: false };

    const existing = await this.prisma.follow.findUnique({
      where: { followerId_followeeId: { followerId: user.userId, followeeId } },
    });

    if (existing) {
      await this.prisma.follow.delete({
        where: { followerId_followeeId: { followerId: user.userId, followeeId } },
      });
      return { following: false };
    }

    const follower = await this.prisma.user.findUnique({
      where: { id: user.userId },
      select: { username: true },
    });

    await this.prisma.follow.create({ data: { followerId: user.userId, followeeId } });
    const notification = await this.prisma.notification.create({
      data: {
        userId: followeeId,
        type: "NEW_FOLLOWER",
        message: `${follower?.username || "Someone"} started following you`,
      },
    });
    this.notificationsGateway.emitNotification(followeeId, toNotificationDto(notification));
    this.notificationsGateway.emitFollow({ followerId: user.userId, followeeId });

    return { following: true };
  }

  @Get(":username/activity")
  async getActivity(@Param("username") username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!user) return [];

    const [followers, posts, snippets, likes] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followeeId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { follower: { select: { username: true } } },
      }),
      this.prisma.post.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, createdAt: true },
      }),
      this.prisma.snippet.findMany({
        where: { authorId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, title: true, createdAt: true },
      }),
      this.prisma.postLike.findMany({
        where: { post: { authorId: user.id } },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: { select: { username: true } }, post: { select: { id: true } } },
      }),
    ]);

    const timeline = [
      ...followers.map((entry: { follower: { username: string }; createdAt: Date }) => ({
        type: "FOLLOW",
        user: entry.follower.username,
        createdAt: entry.createdAt,
      })),
      ...posts.map((entry: { id: string; createdAt: Date }) => ({
        type: "POST_CREATED",
        postId: entry.id,
        createdAt: entry.createdAt,
      })),
      ...snippets.map((entry: { id: string; title: string; createdAt: Date }) => ({
        type: "SNIPPET_CREATED",
        snippetId: entry.id,
        snippetTitle: entry.title,
        createdAt: entry.createdAt,
      })),
      ...likes.map((entry: { user: { username: string }; post: { id: string }; createdAt: Date }) => ({
        type: "LIKE",
        user: entry.user.username,
        postId: entry.post.id,
        createdAt: entry.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    return timeline;
  }

  private resolveRequestIp(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    if (typeof forwarded === "string") {
      return forwarded.split(",")[0]?.trim() || req.ip;
    }
    return req.ip;
  }
}
