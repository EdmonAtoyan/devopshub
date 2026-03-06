import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { ToolsController } from "./tools.controller";

@Module({
  controllers: [ToolsController],
  providers: [PrismaService],
})
export class ToolsModule {}
