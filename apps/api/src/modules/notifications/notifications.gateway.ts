import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

@WebSocketGateway({
  cors: { origin: "*" },
})
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const userId = this.readUserId(client);
    if (userId) client.join(this.userRoom(userId));
  }

  @SubscribeMessage("join_user")
  handleJoinUser(@ConnectedSocket() client: Socket, @MessageBody() payload: { userId?: string }) {
    const userId = payload?.userId?.trim();
    if (!userId) return { ok: false };
    client.join(this.userRoom(userId));
    return { ok: true };
  }

  emitNotification(userId: string, notification: unknown) {
    this.server.to(this.userRoom(userId)).emit("new_notification", notification);
  }

  emitFollow(payload: { followerId: string; followeeId: string }) {
    this.server.emit("new_follow", payload);
  }

  emitPost(post: unknown) {
    this.server.emit("new_post", post);
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }

  private readUserId(client: Socket) {
    const queryUserId = client.handshake.query?.userId;
    if (typeof queryUserId === "string" && queryUserId.trim()) return queryUserId.trim();
    return null;
  }
}
