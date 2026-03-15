import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { Request } from "express";
import { toNotificationDto } from "../../common/notifications";
import { OptionalJwtAuthGuard } from "../../common/optional-jwt-auth.guard";
import { clampInt } from "../../common/query";
import { normalizeTagNames } from "../../common/tags";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../prisma.service";
import { CreateCommentDto, CreatePostDto, UpdateCommentDto, UpdatePostDto } from "./dto";
import { buildPostInclude, enrichPosts } from "./post-query";

const POST_VIEW_WINDOW_MS = 15 * 60_000;

@Controller(["feed", "posts"])
export class FeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async list(
    @Query("sort") sort = "latest",
    @Query("limit") limit = "30",
    @Query("commentLimit") commentLimit = "12",
    @CurrentUser() user: { userId: string } | null = null,
  ) {
    let orderBy:
      | { createdAt: "desc" }
      | [{ likeCount: "desc" }, { createdAt: "desc" }]
      | [{ comments: { _count: "desc" } }, { createdAt: "desc" }] = { createdAt: "desc" };
    if (sort === "likes" || sort === "top") {
      orderBy = [{ likeCount: "desc" }, { createdAt: "desc" }];
    } else if (sort === "comments") {
      orderBy = [{ comments: { _count: "desc" } }, { createdAt: "desc" }];
    }
    const safeLimit = clampInt(limit, 1, 50, 30);
    const safeCommentLimit = clampInt(commentLimit, 0, 20, 12);

    const posts = await this.prisma.post.findMany({
      orderBy,
      include: buildPostInclude(safeCommentLimit),
      take: safeLimit,
    });

    return enrichPosts(
      this.prisma,
      posts as Array<Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }>,
      safeCommentLimit,
      user?.userId,
    );
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(":id")
  async getById(
    @Param("id") id: string,
    @Query("commentLimit") commentLimit = "12",
    @CurrentUser() user: { userId: string } | null = null,
  ) {
    const safeCommentLimit = clampInt(commentLimit, 0, 20, 12);
    const post = await this.prisma.post.findUnique({
      where: { id },
      include: buildPostInclude(safeCommentLimit),
    });

    if (!post) return null;

    const [enrichedPost] = await enrichPosts(
      this.prisma,
      [post as Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }],
      safeCommentLimit,
      user?.userId,
    );

    return enrichedPost;
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreatePostDto, @CurrentUser() user: { userId: string }) {
    const tagLinks = await this.resolveTags(dto.tags || []);

    const post = await this.prisma.post.create({
      data: {
        body: dto.body,
        codeBlock: dto.codeBlock,
        codeLang: dto.codeLang,
        linkUrl: dto.linkUrl,
        authorId: user.userId,
        tags: {
          create: tagLinks.map((tagId) => ({ tagId })),
        },
      },
      include: buildPostInclude(12),
    });

    const [enrichedPost] = await enrichPosts(
      this.prisma,
      [post as Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }],
      12,
      user.userId,
    );

    this.notificationsGateway.emitPost(enrichedPost);
    return enrichedPost;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: { userId: string },
  ) {
    const post = await this.ensureOwnership(id, user.userId);
    if (post.originalPostId) {
      throw new ForbiddenException("Reposts cannot be edited");
    }

    if (dto.tags) {
      await this.prisma.postTag.deleteMany({ where: { postId: id } });
      const tagLinks = await this.resolveTags(dto.tags);
      await this.prisma.postTag.createMany({
        data: tagLinks.map((tagId) => ({ postId: id, tagId })),
        skipDuplicates: true,
      });
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: {
        body: dto.body,
        codeBlock: dto.codeBlock,
        codeLang: dto.codeLang,
        linkUrl: dto.linkUrl,
      },
      include: buildPostInclude(12),
    });

    const [enrichedPost] = await enrichPosts(
      this.prisma,
      [updated as Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }],
      12,
      user.userId,
    );
    return enrichedPost;
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const post = await this.ensureOwnership(id, user.userId);
    if (post.originalPostId) {
      await this.prisma.$transaction([
        this.prisma.post.delete({ where: { id } }),
        this.prisma.$executeRaw`
          UPDATE "Post"
          SET "repostCount" = GREATEST("repostCount" - 1, 0)
          WHERE "id" = ${post.originalPostId}
        `,
      ]);
      return { success: true };
    }

    await this.prisma.post.delete({ where: { id } });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/like")
  async toggleLike(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const existing = await this.prisma.postLike.findUnique({ where: { userId_postId: { userId: user.userId, postId: id } } });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.postLike.delete({ where: { userId_postId: { userId: user.userId, postId: id } } }),
        this.prisma.post.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.postLike.create({ data: { userId: user.userId, postId: id } }),
      this.prisma.post.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);

    const [post, actor] = await Promise.all([
      this.prisma.post.findUnique({ where: { id }, select: { authorId: true } }),
      this.prisma.user.findUnique({ where: { id: user.userId }, select: { username: true } }),
    ]);

    if (post?.authorId && post.authorId !== user.userId) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: post.authorId,
          type: "POST_LIKE",
          message: `${actor?.username || "Someone"} liked your post`,
        },
      });
      this.notificationsGateway.emitNotification(post.authorId, toNotificationDto(notification));
    }

    return { liked: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/repost")
  async toggleRepost(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const rootPost = await this.resolveRootPost(id);
    if (rootPost.authorId === user.userId) {
      throw new BadRequestException("You cannot repost your own post");
    }

    const [existing] = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "Post"
      WHERE "authorId" = ${user.userId} AND "originalPostId" = ${rootPost.id}
      LIMIT 1
    `;

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.post.delete({ where: { id: existing.id } }),
        this.prisma.$executeRaw`
          UPDATE "Post"
          SET "repostCount" = GREATEST("repostCount" - 1, 0)
          WHERE "id" = ${rootPost.id}
        `,
      ]);
      return { reposted: false };
    }

    const repostId = await this.prisma.$transaction(async (tx: any) => {
      const createdId = randomUUID();
      await tx.$executeRaw`
        INSERT INTO "Post" (
          "id",
          "body",
          "authorId",
          "originalPostId",
          "likeCount",
          "viewCount",
          "repostCount",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          ${createdId},
          '',
          ${user.userId},
          ${rootPost.id},
          0,
          0,
          0,
          NOW(),
          NOW()
        )
      `;

      await tx.$executeRaw`
        UPDATE "Post"
        SET "repostCount" = "repostCount" + 1
        WHERE "id" = ${rootPost.id}
      `;

      return createdId;
    });

    const repostRecord = await this.prisma.post.findUnique({
      where: { id: repostId },
      include: buildPostInclude(12),
    });
    const [repost] = repostRecord
      ? await enrichPosts(
          this.prisma,
          [repostRecord as Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }],
          12,
          user.userId,
        )
      : [null];

    if (repost) {
      this.notificationsGateway.emitPost(repost);
    }

    return { reposted: true, post: repost };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/bookmark")
  async toggleBookmark(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const existing = await this.prisma.postBookmark.findUnique({ where: { userId_postId: { userId: user.userId, postId: id } } });

    if (existing) {
      await this.prisma.postBookmark.delete({ where: { userId_postId: { userId: user.userId, postId: id } } });
      return { bookmarked: false };
    }

    await this.prisma.postBookmark.create({ data: { userId: user.userId, postId: id } });
    return { bookmarked: true };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post(":id/view")
  async trackView(
    @Param("id") id: string,
    @Req() req: Request,
    @CurrentUser() user: { userId: string } | null,
  ) {
    const rootPost = await this.resolveRootPost(id);
    const recentThreshold = new Date(Date.now() - POST_VIEW_WINDOW_MS);

    if (user?.userId) {
      const [existing] = await this.prisma.$queryRaw<Array<{ lastViewedAt: Date }>>`
        SELECT "lastViewedAt"
        FROM "PostView"
        WHERE "postId" = ${rootPost.id} AND "userId" = ${user.userId}
        LIMIT 1
      `;

      if (existing && existing.lastViewedAt >= recentThreshold) {
        return { counted: false, viewCount: rootPost.viewCount };
      }

      const [updated] = await this.prisma.$transaction(async (tx: any) => {
        if (existing) {
          await tx.$executeRaw`
            UPDATE "PostView"
            SET "lastViewedAt" = NOW()
            WHERE "postId" = ${rootPost.id} AND "userId" = ${user.userId}
          `;
        } else {
          await tx.$executeRaw`
            INSERT INTO "PostView" ("id", "postId", "userId", "lastViewedAt", "createdAt")
            VALUES (${randomUUID()}, ${rootPost.id}, ${user.userId}, NOW(), NOW())
          `;
        }

        return tx.$queryRaw<Array<{ viewCount: number }>>`
          UPDATE "Post"
          SET "viewCount" = "viewCount" + 1
          WHERE "id" = ${rootPost.id}
          RETURNING "viewCount"
        `;
      });

      return { counted: true, viewCount: updated?.viewCount ?? rootPost.viewCount + 1 };
    }

    const viewerHash = this.resolveViewerHash(req);
    const [existing] = await this.prisma.$queryRaw<Array<{ lastViewedAt: Date }>>`
      SELECT "lastViewedAt"
      FROM "PostView"
      WHERE "postId" = ${rootPost.id} AND "viewerHash" = ${viewerHash}
      LIMIT 1
    `;

    if (existing && existing.lastViewedAt >= recentThreshold) {
      return { counted: false, viewCount: rootPost.viewCount };
    }

    const [updated] = await this.prisma.$transaction(async (tx: any) => {
      if (existing) {
        await tx.$executeRaw`
          UPDATE "PostView"
          SET "lastViewedAt" = NOW()
          WHERE "postId" = ${rootPost.id} AND "viewerHash" = ${viewerHash}
        `;
      } else {
        await tx.$executeRaw`
          INSERT INTO "PostView" ("id", "postId", "viewerHash", "lastViewedAt", "createdAt")
          VALUES (${randomUUID()}, ${rootPost.id}, ${viewerHash}, NOW(), NOW())
        `;
      }

      return tx.$queryRaw<Array<{ viewCount: number }>>`
        UPDATE "Post"
        SET "viewCount" = "viewCount" + 1
        WHERE "id" = ${rootPost.id}
        RETURNING "viewCount"
      `;
    });

    return { counted: true, viewCount: updated?.viewCount ?? rootPost.viewCount + 1 };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/comments")
  createComment(
    @Param("id") id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.createCommentRecord({
      postId: id,
      body: dto.body,
      parentId: dto.parentId,
      userId: user.userId,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post("comments")
  createCommentByPostId(
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: { userId: string },
  ) {
    if (!dto.postId) {
      throw new BadRequestException("postId is required");
    }
    return this.createCommentRecord({
      postId: dto.postId,
      body: dto.body,
      parentId: dto.parentId,
      userId: user.userId,
    });
  }

  private async createCommentRecord(input: { postId: string; body: string; parentId?: string; userId: string }) {
    const post = await this.prisma.post.findUnique({
      where: { id: input.postId },
      select: { authorId: true },
    });
    if (!post) {
      throw new BadRequestException("Post not found");
    }

    let parentAuthorId: string | null = null;
    let body = input.body;
    if (input.parentId) {
      const parent = await this.prisma.comment.findUnique({
        where: { id: input.parentId },
        select: { postId: true, authorId: true },
      });

      if (!parent || parent.postId !== input.postId) {
        throw new ForbiddenException("Invalid parent comment");
      }
      parentAuthorId = parent.authorId;
      body = `@reply:${input.parentId}\n${input.body}`;
    }

    const comment = await this.prisma.comment.create({
      data: {
        postId: input.postId,
        authorId: input.userId,
        body,
      },
      include: { author: { select: { id: true, username: true, verified: true, name: true } } },
    });

    const recipients = new Set<string>();
    if (post.authorId !== input.userId) recipients.add(post.authorId);
    if (parentAuthorId && parentAuthorId !== input.userId) recipients.add(parentAuthorId);

    await Promise.all(
      Array.from(recipients).map(async (recipientId) => {
        const notification = await this.prisma.notification.create({
          data: {
            userId: recipientId,
            type: "POST_REPLY",
            message: `${comment.author.username} commented on your post`,
          },
        });
        this.notificationsGateway.emitNotification(recipientId, toNotificationDto(notification));
      }),
    );

    return comment;
  }

  @UseGuards(JwtAuthGuard)
  @Patch("comments/:commentId")
  async updateComment(
    @Param("commentId") commentId: string,
    @Body() dto: UpdateCommentDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureCommentOwnership(commentId, user.userId);
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: { author: { select: { id: true, username: true, verified: true, name: true } } },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete("comments/:commentId")
  async deleteComment(
    @Param("commentId") commentId: string,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureCommentOwnership(commentId, user.userId);
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { success: true };
  }

  private async ensureOwnership(postId: string, userId: string) {
    const [post] = await this.prisma.$queryRaw<Array<{ authorId: string; originalPostId: string | null }>>`
      SELECT "authorId", "originalPostId"
      FROM "Post"
      WHERE "id" = ${postId}
      LIMIT 1
    `;
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own posts");
    }
    return post;
  }

  private async ensureCommentOwnership(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
    if (!comment || comment.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own comments");
    }
  }

  private async resolveTags(rawTags: string[]) {
    const unique = normalizeTagNames(rawTags);

    const tags = await Promise.all(
      unique.map((name) =>
        this.prisma.tag.upsert({
          where: { name },
          update: {},
          create: { name },
        }),
      ),
    );

    return tags.map((tag) => tag.id);
  }

  private async resolveRootPost(postId: string) {
    const [post] = await this.prisma.$queryRaw<Array<{ id: string; authorId: string; originalPostId: string | null; viewCount: number }>>`
      SELECT "id", "authorId", "originalPostId", "viewCount"
      FROM "Post"
      WHERE "id" = ${postId}
      LIMIT 1
    `;

    if (!post) {
      throw new BadRequestException("Post not found");
    }

    if (!post.originalPostId) {
      return post;
    }

    const [originalPost] = await this.prisma.$queryRaw<Array<{ id: string; authorId: string; viewCount: number }>>`
      SELECT "id", "authorId", "viewCount"
      FROM "Post"
      WHERE "id" = ${post.originalPostId}
      LIMIT 1
    `;

    if (!originalPost) {
      throw new BadRequestException("Post not found");
    }

    return {
      ...originalPost,
      originalPostId: null,
    };
  }

  private resolveViewerHash(req: Request) {
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const ip = forwardedValue?.split(",")[0]?.trim() || req.ip || req.socket.remoteAddress || "unknown-ip";
    const userAgent = req.headers["user-agent"] || "unknown-agent";

    return createHash("sha256")
      .update(`${ip}|${userAgent}`)
      .digest("hex");
  }
}
