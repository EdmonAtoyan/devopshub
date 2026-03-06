import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaService } from "../../prisma.service";
import { FeedController } from "./feed.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [FeedController],
  providers: [PrismaService],
})
export class FeedModule {}
