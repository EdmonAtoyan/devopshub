import { Module } from "@nestjs/common";
import { MentionsModule } from "../mentions/mentions.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { FeedController } from "./feed.controller";

@Module({
  imports: [NotificationsModule, MentionsModule],
  controllers: [FeedController],
})
export class FeedModule {}
