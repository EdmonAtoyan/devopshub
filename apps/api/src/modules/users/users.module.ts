import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { PrismaService } from "../../prisma.service";
import { UsersController } from "./users.controller";

@Module({
  imports: [NotificationsModule],
  controllers: [UsersController],
  providers: [PrismaService],
})
export class UsersModule {}
