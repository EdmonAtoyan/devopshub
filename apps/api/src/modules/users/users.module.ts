import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { UsersController } from "./users.controller";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [UsersController],
})
export class UsersModule {}
