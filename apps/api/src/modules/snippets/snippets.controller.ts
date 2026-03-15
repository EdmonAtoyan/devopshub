import {
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
import { clampInt } from "../../common/query";
import { normalizeTagNames } from "../../common/tags";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PrismaService } from "../../prisma.service";
import { CreateSnippetDto, UpdateSnippetDto } from "./dto";

@Controller("snippets")
export class SnippetsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query("language") language?: string, @Query("limit") limit = "30") {
    const safeLimit = clampInt(limit, 1, 60, 30);
    return this.prisma.snippet.findMany({
      where: language ? { language } : undefined,
      include: {
        author: { select: { id: true, username: true, verified: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: safeLimit,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateSnippetDto, @CurrentUser() user: { userId: string }) {
    const tagLinks = await this.resolveTags(dto.tags || []);

    return this.prisma.snippet.create({
      data: {
        title: dto.title,
        description: dto.description,
        language: dto.language,
        code: dto.code,
        authorId: user.userId,
        tags: {
          create: tagLinks.map((tagId) => ({ tagId })),
        },
      },
      include: {
        author: { select: { id: true, username: true, verified: true, name: true } },
        tags: { select: { tag: { select: { name: true } } } },
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateSnippetDto,
    @CurrentUser() user: { userId: string },
  ) {
    await this.ensureOwnership(id, user.userId);

    if (dto.tags) {
      await this.prisma.snippetTag.deleteMany({ where: { snippetId: id } });
      const tagLinks = await this.resolveTags(dto.tags);
      await this.prisma.snippetTag.createMany({
        data: tagLinks.map((tagId) => ({ snippetId: id, tagId })),
        skipDuplicates: true,
      });
    }

    return this.prisma.snippet.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        language: dto.language,
        code: dto.code,
        version: dto.code ? { increment: 1 } : undefined,
      },
    });
  }

  @UseGuards(JwtAuthGuard)
  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    await this.ensureOwnership(id, user.userId);
    await this.prisma.snippet.delete({ where: { id } });
    return { success: true };
  }

  private async ensureOwnership(snippetId: string, userId: string) {
    const snippet = await this.prisma.snippet.findUnique({ where: { id: snippetId }, select: { authorId: true } });
    if (!snippet || snippet.authorId !== userId) {
      throw new ForbiddenException("You can only modify your own snippets");
    }
  }

  private async resolveTags(rawTags: string[]) {
    const unique = normalizeTagNames(rawTags);

    const tags = await Promise.all(
      unique.map((name) => this.prisma.tag.upsert({ where: { name }, update: {}, create: { name } })),
    );

    return tags.map((tag) => tag.id);
  }
}
