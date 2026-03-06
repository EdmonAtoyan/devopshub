import { Controller, Get, Query } from "@nestjs/common";
import { NewsService } from "./news.service";

@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  latest(@Query("limit") limit?: string) {
    const parsed = Number(limit);
    const finalLimit = Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 20) : 8;
    return this.newsService.latest(finalLimit);
  }
}
