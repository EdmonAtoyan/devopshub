import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaService } from "../../prisma.service";
import { ArticlesController } from "./articles.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [ArticlesController],
  providers: [PrismaService],
})
export class ArticlesModule {}
