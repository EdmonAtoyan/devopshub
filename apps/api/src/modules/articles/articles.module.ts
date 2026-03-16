import { Module } from "@nestjs/common";
import { MentionsModule } from "../mentions/mentions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { ArticlesController } from "./articles.controller";

@Module({
  imports: [NotificationsModule, MentionsModule],
  controllers: [ArticlesController],
})
export class ArticlesModule {}
