import { Module } from "@nestjs/common";
import { PrismaService } from "../../prisma.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsGateway } from "./notifications.gateway";

@Module({
  controllers: [NotificationsController],
  providers: [PrismaService, NotificationsGateway],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
