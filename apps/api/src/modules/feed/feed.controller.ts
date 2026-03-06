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
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../prisma.service";
import { CreateCommentDto, CreatePostDto, UpdateCommentDto, UpdatePostDto } from "./dto";

@Controller(["feed", "posts"])
export class FeedController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get()
  list(
    @Query("sort") sort = "latest",
    @Query("limit") limit = "30",
    @Query("commentLimit") commentLimit = "12",
  ) {
    let orderBy: any = { createdAt: "desc" };
    if (sort === "likes" || sort === "top") {
      orderBy = [{ likeCount: "desc" }, { createdAt: "desc" }];
    } else if (sort === "comments") {
      orderBy = [{ comments: { _count: "desc" } }, { createdAt: "desc" }];
    }
    const safeLimit = this.clamp(limit, 1, 50, 30);
    const safeCommentLimit = this.clamp(commentLimit, 0, 20, 12);

    return this.prisma.post.findMany({
      orderBy,
      include: {
        author: { select: { id: true, username: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: safeCommentLimit,
          include: { author: { select: { id: true, username: true, name: true } } },
        },
        _count: { select: { likes: true, comments: true, bookmarks: true } },
      },
      take: safeLimit,
    });
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
      include: {
        author: { select: { id: true, username: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { author: { select: { id: true, username: true, name: true } } },
        },
        _count: { select: { likes: true, comments: true, bookmarks: true } },
      },
    });

    this.notificationsGateway.emitPost(post);
    return post;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdatePostDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureOwnership(id, user.userId);

    if (dto.tags) {
      await this.prisma.postTag.deleteMany({ where: { postId: id } });
      const tagLinks = await this.resolveTags(dto.tags);
      await this.prisma.postTag.createMany({
        data: tagLinks.map((tagId) => ({ postId: id, tagId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.post.update({
      where: { id },
      data: {
        body: dto.body,
        codeBlock: dto.codeBlock,
        codeLang: dto.codeLang,
        linkUrl: dto.linkUrl,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    await this.ensureOwnership(id, user.userId);
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
      this.notificationsGateway.emitNotification(post.authorId, {
        id: notification.id,
        userId: notification.userId,
        type: "LIKE",
        message: notification.message,
        createdAt: notification.createdAt,
        isRead: notification.read,
      });
    }

    return { liked: true };
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
      include: { author: { select: { id: true, username: true, name: true } } },
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
        this.notificationsGateway.emitNotification(recipientId, {
          id: notification.id,
          userId: notification.userId,
          type: "COMMENT",
          message: notification.message,
          createdAt: notification.createdAt,
          isRead: notification.read,
        });
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
      include: { author: { select: { id: true, username: true, name: true } } },
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
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (!post || post.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own posts");
    }
  }

  private async ensureCommentOwnership(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({ where: { id: commentId }, select: { authorId: true } });
    if (!comment || comment.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own comments");
    }
  }

  private async resolveTags(rawTags: string[]) {
    const clean = rawTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const unique = Array.from(new Set(clean));

    const tags = await Promise.all(unique.map((name) =>
      this.prisma.tag.upsert({
        where: { name },
        update: {},
        create: { name },
      }),
    ));

    return tags.map((tag) => tag.id);
  }

  private clamp(value: string, min: number, max: number, fallback: number) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }
}
