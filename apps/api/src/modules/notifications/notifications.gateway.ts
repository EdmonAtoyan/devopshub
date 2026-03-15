import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { JwtService } from "@nestjs/jwt";
import { Server, Socket } from "socket.io";
import { corsOriginValidator } from "../../common/cors";

@WebSocketGateway({
  cors: {
    origin: corsOriginValidator,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection {
  constructor(private readonly jwtService: JwtService) {}

  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const userId = this.resolveAuthenticatedUserId(client);
    if (userId) client.join(this.userRoom(userId));
  }

  @SubscribeMessage("join_user")
  handleJoinUser(@ConnectedSocket() client: Socket, @MessageBody() _payload?: { userId?: string }) {
    const userId = this.resolveAuthenticatedUserId(client);
    if (!userId) return { ok: false };
    client.join(this.userRoom(userId));
    return { ok: true, userId };
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

  private resolveAuthenticatedUserId(client: Socket) {
    const existing = client.data.userId;
    if (typeof existing === "string" && existing.trim()) return existing.trim();

    const token = this.readToken(client);
    if (!token) return null;

    try {
      const payload = this.jwtService.verify<{ sub?: string }>(token);
      const userId = payload.sub?.trim();
      if (!userId) return null;
      client.data.userId = userId;
      return userId;
    } catch {
      return null;
    }
  }

  private readToken(client: Socket) {
    const fromAuth = this.normalizeToken(this.readHandshakeAuthToken(client));
    if (fromAuth) return fromAuth;

    const fromHeader = this.normalizeToken(client.handshake.headers.authorization);
    if (fromHeader) return fromHeader;

    const cookieHeader = client.handshake.headers.cookie;
    if (!cookieHeader) return null;

    const rawCookie = Array.isArray(cookieHeader) ? cookieHeader.join(";") : cookieHeader;
    const accessToken = rawCookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("access_token="));

    if (!accessToken) return null;
    return this.normalizeToken(decodeURIComponent(accessToken.slice("access_token=".length)));
  }

  private readHandshakeAuthToken(client: Socket) {
    const auth = client.handshake.auth;
    if (!auth || typeof auth !== "object") return null;

    const token = (auth as Record<string, unknown>).token;
    if (typeof token !== "string") return null;
    return token;
  }

  private normalizeToken(value?: string | null) {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return trimmed.replace(/^Bearer\s+/i, "").trim() || null;
  }
}
