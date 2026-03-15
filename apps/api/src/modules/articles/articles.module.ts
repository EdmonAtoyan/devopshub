import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { ArticlesController } from "./articles.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [ArticlesController],
})
export class ArticlesModule {}
