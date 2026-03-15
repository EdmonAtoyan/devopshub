import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { FeedController } from "./feed.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [FeedController],
})
export class FeedModule {}
