import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { toNotificationDto } from "../../common/notifications";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PrismaService } from "../../prisma.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async myNotifications(@CurrentUser() user: { userId: string }) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: user.userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      this.prisma.notification.count({
        where: { userId: user.userId, read: false },
      }),
    ]);

    return {
      unreadCount,
      notifications: items.map(toNotificationDto),
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch(":id/read")
  async markRead(@Param("id") id: string, @CurrentUser() user: { userId: string }) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, userId: user.userId },
      data: { read: true },
    });

    if (updated.count === 0) {
      return { success: false };
    }

    const unreadCount = await this.prisma.notification.count({
      where: { userId: user.userId, read: false },
    });

    return { success: true, unreadCount };
  }
}
