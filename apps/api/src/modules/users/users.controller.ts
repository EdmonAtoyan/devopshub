import {
  BadRequestException,
  Body,
  Controller,
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
import { Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import { authCookieClearOptions } from "../../common/auth-cookie";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../prisma.service";
import { UpdateProfileDto } from "./dto";

const { diskStorage } = require("multer");

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get(":username")
  async getByUsername(@Param("username") username: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
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

  @UseGuards(JwtAuthGuard)
  @Get("me/profile")
  me(@CurrentUser() user: { userId: string }) {
    return this.prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch("me/profile")
  async updateProfile(
    @CurrentUser() user: { userId: string },
    @Body() dto: UpdateProfileDto,
  ) {
    const data: {
      username?: string;
      email?: string;
      bio?: string;
    } = {};

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
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email },
        select: { id: true },
      });
      if (existing && existing.id !== user.userId) {
        throw new BadRequestException("Email already in use");
      }
      data.email = email;
    }

    if (dto.bio !== undefined) data.bio = dto.bio.trim();

    return this.prisma.user.update({
      where: { id: user.userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("me/avatar")
  @UseInterceptors(
    FileInterceptor("avatar", {
      storage: diskStorage({
        destination: (_req: unknown, _file: unknown, cb: (error: Error | null, destination: string) => void) => {
          const dir = resolveUploadDir();
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (
          _req: unknown,
          file: { originalname?: string },
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const ext = path.extname(file.originalname || "").toLowerCase() || ".png";
          const name = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
          cb(null, name);
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
    this.notificationsGateway.emitNotification(followeeId, {
      id: notification.id,
      userId: notification.userId,
      type: "FOLLOW",
      message: notification.message,
      createdAt: notification.createdAt,
      isRead: notification.read,
    });
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
      ...followers.map((entry: any) => ({
        type: "FOLLOW",
        user: entry.follower.username,
        createdAt: entry.createdAt,
      })),
      ...posts.map((entry: any) => ({
        type: "POST_CREATED",
        postId: entry.id,
        createdAt: entry.createdAt,
      })),
      ...snippets.map((entry: any) => ({
        type: "SNIPPET_CREATED",
        snippetId: entry.id,
        snippetTitle: entry.title,
        createdAt: entry.createdAt,
      })),
      ...likes.map((entry: any) => ({
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
}

function resolveUploadDir() {
  const fromCwd = path.resolve(process.cwd(), "uploads/avatars");
  const fromWorkspace = path.resolve(process.cwd(), "../../uploads/avatars");

  if (fs.existsSync(path.resolve(process.cwd(), ".env"))) return fromCwd;
  return fromWorkspace;
}
