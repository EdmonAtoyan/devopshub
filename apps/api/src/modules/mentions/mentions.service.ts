import { Injectable } from "@nestjs/common";
import { extractMentionUsernames } from "../../common/mentions";
import { toNotificationDto } from "../../common/notifications";
import { PrismaService } from "../../prisma.service";
import { NotificationsGateway } from "../notifications/notifications.gateway";

type BaseMentionSyncInput = {
  actorId: string;
  text: string;
  contextLabel: "post" | "comment";
};

type PostMentionSyncInput = BaseMentionSyncInput & {
  postId: string;
};

type CommentMentionSyncInput = BaseMentionSyncInput & {
  commentId: string;
  postId: string;
};

type ArticleCommentMentionSyncInput = BaseMentionSyncInput & {
  articleCommentId: string;
};

type MentionRecord = {
  userId: string;
};

type MentionedUser = {
  id: string;
  username: string;
};

type MentionNotificationRecord = {
  id: string;
  userId: string;
  type: "MENTION";
  message: string;
  createdAt: Date;
  read: boolean;
  actorId: string | null;
  postId: string | null;
  commentId: string | null;
  articleCommentId: string | null;
};

@Injectable()
export class MentionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  syncPostMentions(input: PostMentionSyncInput) {
    return this.syncMentions({
      ...input,
      entityKey: "postId",
      entityId: input.postId,
      notificationData: { postId: input.postId },
    });
  }

  syncCommentMentions(input: CommentMentionSyncInput) {
    return this.syncMentions({
      ...input,
      entityKey: "commentId",
      entityId: input.commentId,
      notificationData: {
        postId: input.postId,
        commentId: input.commentId,
      },
    });
  }

  syncArticleCommentMentions(input: ArticleCommentMentionSyncInput) {
    return this.syncMentions({
      ...input,
      entityKey: "articleCommentId",
      entityId: input.articleCommentId,
      notificationData: {
        articleCommentId: input.articleCommentId,
      },
    });
  }

  private async syncMentions(input: {
    actorId: string;
    text: string;
    contextLabel: "post" | "comment";
    entityKey: "postId" | "commentId" | "articleCommentId";
    entityId: string;
    notificationData: {
      postId?: string;
      commentId?: string;
      articleCommentId?: string;
    };
  }) {
    const mentionUsernames = extractMentionUsernames(input.text);
    const [actor, existingMentions, mentionedUsers]: [
      { username: string } | null,
      MentionRecord[],
      MentionedUser[],
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: input.actorId },
        select: { username: true },
      }),
      this.prisma.mention.findMany({
        where: mentionEntityWhere(input.entityKey, input.entityId),
        select: { userId: true },
      }),
      mentionUsernames.length
        ? this.prisma.user.findMany({
            where: { username: { in: mentionUsernames } },
            select: { id: true, username: true },
          })
        : Promise.resolve<Array<{ id: string; username: string }>>([]),
    ]);

    const existingUserIds = new Set(existingMentions.map((entry) => entry.userId));
    const nextUsers = mentionedUsers.filter((entry) => entry.id !== input.actorId);
    const nextUserIds = new Set(nextUsers.map((entry) => entry.id));
    const removedUserIds = existingMentions
      .map((entry) => entry.userId)
      .filter((userId) => !nextUserIds.has(userId));
    const addedUsers = nextUsers.filter((entry) => !existingUserIds.has(entry.id));

    const createdNotifications: MentionNotificationRecord[] = await this.prisma.$transaction(async (tx: any) => {
      if (removedUserIds.length > 0) {
        await tx.mention.deleteMany({
          where: {
            ...mentionEntityWhere(input.entityKey, input.entityId),
            userId: { in: removedUserIds },
          },
        });
      }

      if (addedUsers.length > 0) {
        await tx.mention.createMany({
          data: addedUsers.map((entry) => ({
            userId: entry.id,
            actorId: input.actorId,
            ...mentionEntityData(input.entityKey, input.entityId),
          })),
          skipDuplicates: true,
        });
      }

      return Promise.all(
        addedUsers.map((entry) =>
          tx.notification.create({
            data: {
              userId: entry.id,
              actorId: input.actorId,
              type: "MENTION",
              message: `${actor?.username || "Someone"} mentioned you in a ${input.contextLabel}`,
              ...input.notificationData,
            },
          }),
        ),
      );
    });

    createdNotifications.forEach((notification: MentionNotificationRecord) => {
      this.notificationsGateway.emitNotification(notification.userId, toNotificationDto(notification));
    });

    return Array.from(nextUserIds);
  }
}

function mentionEntityWhere(entityKey: "postId" | "commentId" | "articleCommentId", entityId: string) {
  if (entityKey === "postId") {
    return { postId: entityId };
  }

  if (entityKey === "commentId") {
    return { commentId: entityId };
  }

  return { articleCommentId: entityId };
}

function mentionEntityData(entityKey: "postId" | "commentId" | "articleCommentId", entityId: string) {
  return mentionEntityWhere(entityKey, entityId);
}
