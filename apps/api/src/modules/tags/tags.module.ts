import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { TagsController } from "./tags.controller";

@Module({
  controllers: [TagsController],
  providers: [PrismaService],
})
export class TagsModule {}
