import { Controller, Get, Query } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";

@Controller("tools")
export class ToolsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query("category") category?: string) {
    return this.prisma.tool.findMany({
      where: category ? { category } : undefined,
      orderBy: [{ popularityScore: "desc" }, { name: "asc" }],
      take: 100,
    });
  }
}
