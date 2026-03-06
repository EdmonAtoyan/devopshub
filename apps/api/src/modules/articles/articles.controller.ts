import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Query,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { NotificationsGateway } from "../notifications/notifications.gateway";
import { PrismaService } from "../../prisma.service";
import {
  CreateArticleCommentDto,
  CreateArticleDto,
  UpdateArticleCommentDto,
  UpdateArticleDto,
} from "./dto";

@Controller("articles")
export class ArticlesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Get()
  list(
    @Query("limit") limit = "20",
    @Query("commentLimit") commentLimit = "3",
  ) {
    const safeLimit = this.clamp(limit, 1, 40, 20);
    const safeCommentLimit = this.clamp(commentLimit, 0, 10, 3);

    return this.prisma.article.findMany({
      orderBy: { createdAt: "desc" },
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

  @Get(":slug")
  bySlug(@Param("slug") slug: string) {
    return this.prisma.article.findUnique({
      where: { slug },
      include: {
        author: { select: { id: true, username: true, name: true } },
        tags: { include: { tag: true } },
        comments: { include: { author: { select: { username: true, name: true } } }, orderBy: { createdAt: "desc" } },
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateArticleDto, @CurrentUser() user: { userId: string }) {
    const slug = await this.uniqueSlug(dto.title);
    const tagLinks = await this.resolveTags(dto.tags || []);

    return this.prisma.article.create({
      data: {
        slug,
        title: dto.title,
        body: dto.body,
        coverImage: dto.coverImage,
        authorId: user.userId,
        tags: {
          create: tagLinks.map((tagId) => ({ tagId })),
        },
      },
      include: {
        author: { select: { id: true, username: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureOwnership(id, user.userId);

    if (dto.tags) {
      await this.prisma.articleTag.deleteMany({ where: { articleId: id } });
      const tagLinks = await this.resolveTags(dto.tags);
      await this.prisma.articleTag.createMany({
        data: tagLinks.map((tagId) => ({ articleId: id, tagId })),
        skipDuplicates: true,
      });
    }

    const data: {
      title?: string;
      body?: string;
      coverImage?: string;
      slug?: string;
    } = {
      title: dto.title,
      body: dto.body,
      coverImage: dto.coverImage,
    };

    if (dto.title) {
      data.slug = await this.uniqueSlug(dto.title, id);
    }

    return this.prisma.article.update({ where: { id }, data });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    await this.ensureOwnership(id, user.userId);
    await this.prisma.article.delete({ where: { id } });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/like")
  async toggleLike(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const existing = await this.prisma.articleLike.findUnique({
      where: { userId_articleId: { userId: user.userId, articleId: id } },
    });

    if (existing) {
      await this.prisma.$transaction([
        this.prisma.articleLike.delete({ where: { userId_articleId: { userId: user.userId, articleId: id } } }),
        this.prisma.article.update({ where: { id }, data: { likeCount: { decrement: 1 } } }),
      ]);
      return { liked: false };
    }

    await this.prisma.$transaction([
      this.prisma.articleLike.create({ data: { userId: user.userId, articleId: id } }),
      this.prisma.article.update({ where: { id }, data: { likeCount: { increment: 1 } } }),
    ]);
    return { liked: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/bookmark")
  async toggleBookmark(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const existing = await this.prisma.articleBookmark.findUnique({
      where: { userId_articleId: { userId: user.userId, articleId: id } },
    });

    if (existing) {
      await this.prisma.articleBookmark.delete({
        where: { userId_articleId: { userId: user.userId, articleId: id } },
      });
      return { bookmarked: false };
    }

    await this.prisma.articleBookmark.create({ data: { userId: user.userId, articleId: id } });
    return { bookmarked: true };
  }

  @UseGuards(JwtAuthGuard)
  @Post(":id/comments")
  async addComment(
    @Param("id") id: string,
    @Body() dto: CreateArticleCommentDto,
    @CurrentUser() user: { userId: string },
  ) {
    const article = await this.prisma.article.findUnique({
      where: { id },
      select: { authorId: true },
    });
    if (!article) {
      throw new BadRequestException("Article not found");
    }

    const comment = await this.prisma.articleComment.create({
      data: { articleId: id, authorId: user.userId, body: dto.body },
      include: { author: { select: { username: true, name: true } } },
    });

    if (article.authorId !== user.userId) {
      const notification = await this.prisma.notification.create({
        data: {
          userId: article.authorId,
          type: "ARTICLE_COMMENT",
          message: `${comment.author.username} commented on your article`,
        },
      });
      this.notificationsGateway.emitNotification(article.authorId, {
        id: notification.id,
        userId: notification.userId,
        type: "COMMENT",
        message: notification.message,
        createdAt: notification.createdAt,
        isRead: notification.read,
      });
    }

    return comment;
  }

  @UseGuards(JwtAuthGuard)
  @Patch("comments/:commentId")
  async updateComment(
    @Param("commentId") commentId: string,
    @Body() dto: UpdateArticleCommentDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureCommentOwnership(commentId, user.userId);
    return this.prisma.articleComment.update({
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
    await this.prisma.articleComment.delete({ where: { id: commentId } });
    return { success: true };
  }

  private async ensureOwnership(articleId: string, userId: string) {
    const article = await this.prisma.article.findUnique({ where: { id: articleId }, select: { authorId: true } });
    if (!article || article.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own articles");
    }
  }

  private async ensureCommentOwnership(commentId: string, userId: string) {
    const comment = await this.prisma.articleComment.findUnique({
      where: { id: commentId },
      select: { authorId: true },
    });
    if (!comment || comment.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own comments");
    }
  }

  private async uniqueSlug(title: string, ignoreId?: string) {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "article";

    let slug = base;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.article.findUnique({ where: { slug }, select: { id: true } });
      if (!existing || existing.id === ignoreId) return slug;
      counter += 1;
      slug = `${base}-${counter}`;
    }
  }

  private async resolveTags(rawTags: string[]) {
    const clean = rawTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean);
    const unique = Array.from(new Set(clean));

    const tags = await Promise.all(
      unique.map((name) => this.prisma.tag.upsert({ where: { name }, update: {}, create: { name } })),
    );

    return tags.map((tag) => tag.id);
  }

  private clamp(value: string, min: number, max: number, fallback: number) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }
}
