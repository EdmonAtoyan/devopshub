import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/current-user.decorator";
import { JwtAuthGuard } from "../../common/jwt-auth.guard";
import { PrismaService } from "../../prisma.service";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async myNotifications(@CurrentUser() user: { userId: string }) {
    const items = await this.prisma.notification.findMany({
      where: { userId: user.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = items.filter((item: any) => !item.read).length;
    return {
      unreadCount,
      notifications: items.map((item: any) => ({
        id: item.id,
        userId: item.userId,
        type: item.type === "NEW_FOLLOWER" ? "FOLLOW" : item.type,
        message: item.message,
        createdAt: item.createdAt,
        isRead: item.read,
      })),
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
