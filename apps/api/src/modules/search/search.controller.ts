import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

@Controller("search")
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("users")
  async searchUsers(@Query("q") q = "", @Query("limit") limit = "8") {
    const term = q.trim();
    if (!term) return [];
    const safeLimit = this.clamp(limit, 1, 20, 8);

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
        name: true,
        bio: true,
        avatarUrl: true,
      },
      orderBy: { reputation: "desc" },
      take: safeLimit,
    });
  }

  @Get()
  async search(@Query("q") q = "", @Query("limit") limit = "10") {
    const term = q.trim();
    if (!term) return { users: [], posts: [], articles: [], tools: [], tags: [] };
    const safeLimit = this.clamp(limit, 1, 20, 10);

    const [users, posts, articles, tools, tags] = await Promise.all([
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
          name: true,
          bio: true,
          avatarUrl: true,
        },
        take: safeLimit,
      }),
      this.prisma.post.findMany({
        where: { body: { contains: term, mode: "insensitive" } },
        select: { id: true, body: true, createdAt: true, authorId: true },
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

    return { users, posts, articles, tools, tags };
  }

  private clamp(value: string, min: number, max: number, fallback: number) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isNaN(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }
}
