import { Injectable } from "@nestjs/common";

export type NewsItem = {
  title: string;
  description: string;
  source: string;
  link: string;
  publishedAt?: string;
};

@Injectable()
export class NewsService {
  private cache: { expiresAt: number; items: NewsItem[] } = {
    expiresAt: 0,
    items: [],
  };

  private readonly feeds = [
    { source: "dev.to", url: "https://dev.to/feed/tag/devops" },
    { source: "InfoQ", url: "https://www.infoq.com/devops/rss" },
    { source: "The New Stack", url: "https://thenewstack.io/category/devops/feed/" },
  ];

  async latest(limit = 8): Promise<NewsItem[]> {
    const now = Date.now();
    if (this.cache.items.length > 0 && this.cache.expiresAt > now) {
      return this.cache.items.slice(0, limit);
    }

    const results = await Promise.allSettled(this.feeds.map((feed) => this.loadFeed(feed.url, feed.source)));

    const items = Array.from(
      new Map(
        results
          .filter((result): result is PromiseFulfilledResult<NewsItem[]> => result.status === "fulfilled")
          .flatMap((result) => result.value)
          .map((item) => [item.link, item]),
      ).values(),
    )
      .sort((a, b) => {
        const left = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const right = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return right - left;
      })
      .slice(0, 20);

    this.cache = {
      expiresAt: now + 5 * 60 * 1000,
      items,
    };

    return items.slice(0, limit);
  }

  private async loadFeed(url: string, source: string): Promise<NewsItem[]> {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "DevOpsHubNewsBot/1.0",
      },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];

    const items: NewsItem[] = [];
    for (const block of blocks) {
      const title = this.decode(this.extractTag(block, "title"));
      const descriptionRaw = this.decode(this.extractTag(block, "description"));
      const description = this.strip(descriptionRaw).slice(0, 180);
      const link = this.decode(this.extractTag(block, "link"));
      const publishedAt = this.decode(this.extractTag(block, "pubDate"));

      if (!title || !link) continue;

      items.push({
        title: this.stripEmoji(title),
        description: this.stripEmoji(description),
        source,
        link,
        publishedAt: publishedAt || undefined,
      });
    }

    return items;
  }

  private extractTag(input: string, tag: string): string {
    const match = input.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
    return match?.[1]?.trim() || "";
  }

  private strip(value: string): string {
    return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  private decode(value: string): string {
    return value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private stripEmoji(value: string): string {
    return value
      .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}]/gu, "")
      .replace(/\uFE0F/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  }
}
