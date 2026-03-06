import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { SnippetsController } from "./snippets.controller";

@Module({
  controllers: [SnippetsController],
  providers: [PrismaService],
})
export class SnippetsModule {}
