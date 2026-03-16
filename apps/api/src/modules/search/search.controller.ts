import { Controller, Get, Query, ServiceUnavailableException, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CurrentUser } from "../../common/current-user.decorator";
import { OptionalJwtAuthGuard } from "../../common/optional-jwt-auth.guard";
import { clampInt } from "../../common/query";
import { PrismaService } from "../../prisma.service";
import { buildPostInclude, enrichPosts } from "../feed/post-query";

@Controller("search")
export class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  @Get("users")
  async searchUsers(@Query("q") q = "", @Query("limit") limit = "8") {
    const term = q.trim().toLowerCase();
    const safeLimit = clampInt(limit, 1, 20, 8);

    const users = await this.prisma.user.findMany({
      where: term
        ? {
            OR: [
              { username: { contains: term, mode: "insensitive" } },
              { name: { contains: term, mode: "insensitive" } },
            ],
          }
        : undefined,
      select: {
        id: true,
        username: true,
        verified: true,
        name: true,
        bio: true,
        avatarUrl: true,
      },
      orderBy: [{ reputation: "desc" }, { createdAt: "desc" }],
      take: term ? safeLimit * 3 : safeLimit,
    });

    if (!term) {
      return users;
    }

    return users
      .sort(
        (
          left: { username: string; name: string },
          right: { username: string; name: string },
        ) => compareUserSearch(left, right, term),
      )
      .slice(0, safeLimit);
  }

  @Get("gifs")
  async searchGifs(@Query("q") q = "", @Query("limit") limit = "20") {
    const apiKey = this.configService.get<string>("GIPHY_API_KEY")?.trim();
    const safeLimit = clampInt(limit, 1, 20, 20);
    const query = q.trim();

    if (!apiKey) {
      return {
        configured: false,
        provider: "giphy",
        results: [],
      };
    }

    if (!query) {
      return {
        configured: true,
        provider: "giphy",
        results: [],
      };
    }

    const url = new URL("https://api.giphy.com/v1/gifs/search");

    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", String(safeLimit));
    url.searchParams.set("rating", "pg");

    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new ServiceUnavailableException("GIF search is unavailable right now");
    }

    const payload = (await response.json()) as GiphySearchResponse;

    return {
      configured: true,
      provider: "giphy",
      results: payload.data
        .map((entry) => {
          const gif = entry.images.original;
          const preview = entry.images.fixed_width ?? entry.images.preview_gif ?? entry.images.original;

          if (!gif?.url || !preview?.url) {
            return null;
          }

          return {
            id: entry.id,
            url: gif.url,
            previewUrl: preview.url,
            width: parseGifDimension(preview.width) ?? parseGifDimension(gif.width) ?? 1,
            height: parseGifDimension(preview.height) ?? parseGifDimension(gif.height) ?? 1,
            alt: resolveGifAlt(entry.title),
          };
        })
        .filter((entry): entry is NonNullable<typeof entry> => !!entry),
    };
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

function compareUserSearch(
  left: { username: string; name: string },
  right: { username: string; name: string },
  term: string,
) {
  const score = (entry: { username: string; name: string }) => {
    const username = entry.username.toLowerCase();
    const name = entry.name.toLowerCase();

    if (username === term) return 5;
    if (username.startsWith(term)) return 4;
    if (name.startsWith(term)) return 3;
    if (username.includes(term)) return 2;
    if (name.includes(term)) return 1;
    return 0;
  };

  return score(right) - score(left) || left.username.localeCompare(right.username);
}

type GiphyImage = {
  url?: string;
  width?: string;
  height?: string;
};

type GiphySearchResponse = {
  data: Array<{
    id: string;
    title?: string;
    images: {
      original?: GiphyImage;
      fixed_width?: GiphyImage;
      preview_gif?: GiphyImage;
    };
  }>;
};

function parseGifDimension(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function resolveGifAlt(title?: string) {
  const cleaned = title?.replace(/\s*gif\s*$/i, "").trim();
  return cleaned || "GIF reaction";
}
