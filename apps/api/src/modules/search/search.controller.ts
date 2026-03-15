import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/current-user.decorator";
import { OptionalJwtAuthGuard } from "../../common/optional-jwt-auth.guard";
import { clampInt } from "../../common/query";
import { PrismaService } from "../../prisma.service";
import { buildPostInclude, enrichPosts } from "../feed/post-query";

@Controller("search")
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("users")
  async searchUsers(@Query("q") q = "", @Query("limit") limit = "8") {
    const term = q.trim();
    if (!term) return [];
    const safeLimit = clampInt(limit, 1, 20, 8);

    return this.prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: term, mode: "insensitive" } },
          { name: { contains: term, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        verified: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
      orderBy: { reputation: "desc" },
      take: safeLimit,
    });
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  async search(
    @Query("q") q = "",
    @Query("limit") limit = "10",
    @CurrentUser() user: { userId: string } | null = null,
  ) {
    const term = q.trim();
    if (!term) return { users: [], posts: [], articles: [], tools: [], tags: [] };
    const safeLimit = clampInt(limit, 1, 20, 10);

    const [users, postsRaw, articles, tools, tags] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: term, mode: "insensitive" } },
            { name: { contains: term, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          username: true,
          verified: true,
          name: true,
          bio: true,
          avatarUrl: true,
        },
        take: safeLimit,
      }),
      this.prisma.post.findMany({
        where: { body: { contains: term, mode: "insensitive" } },
        include: buildPostInclude(0),
        orderBy: { createdAt: "desc" },
        take: safeLimit,
      }),
      this.prisma.article.findMany({
        where: {
          OR: [{ title: { contains: term, mode: "insensitive" } }, { body: { contains: term, mode: "insensitive" } }],
        },
        select: { id: true, slug: true, title: true, createdAt: true, authorId: true },
        take: safeLimit,
      }),
      this.prisma.tool.findMany({
        where: {
          OR: [{ name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } }],
        },
        select: { id: true, name: true, category: true, description: true, popularityScore: true },
        take: safeLimit,
      }),
      this.prisma.tag.findMany({
        where: { name: { contains: term, mode: "insensitive" } },
        select: { id: true, name: true },
        take: safeLimit,
      }),
    ]);

    const posts = await enrichPosts(
      this.prisma,
      postsRaw as Array<Record<string, unknown> & { id: string; _count: { likes: number; comments: number; bookmarks: number } }>,
      0,
      user?.userId,
    );

    return { users, posts, articles, tools, tags };
  }
}
