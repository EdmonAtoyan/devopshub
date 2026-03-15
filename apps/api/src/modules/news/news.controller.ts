import { Controller, Get, Query } from "@nestjs/common";
import { clampInt } from "../../common/query";
import { NewsService } from "./news.service";

@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  latest(@Query("limit") limit?: string) {
    return this.newsService.latest(clampInt(limit, 1, 20, 8));
  }
}
