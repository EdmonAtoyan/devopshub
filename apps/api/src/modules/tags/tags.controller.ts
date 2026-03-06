import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

@Controller("tags")
export class TagsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("trending")
  trending() {
    return this.prisma.tag.findMany({
      orderBy: { followerCount: "desc" },
      take: 20,
    });
  }
}
