type NotificationType = "POST_REPLY" | "POST_LIKE" | "ARTICLE_COMMENT" | "NEW_FOLLOWER" | "MENTION";

type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  createdAt: Date;
  read: boolean;
  actorId?: string | null;
  postId?: string | null;
  commentId?: string | null;
  articleCommentId?: string | null;
};

const notificationTypeAlias: Partial<Record<NotificationType, string>> = {
  ARTICLE_COMMENT: "COMMENT",
  NEW_FOLLOWER: "FOLLOW",
  POST_LIKE: "LIKE",
  POST_REPLY: "COMMENT",
};

export function toNotificationDto(notification: NotificationRecord) {
  return {
    id: notification.id,
    userId: notification.userId,
    actorId: notification.actorId ?? null,
    postId: notification.postId ?? null,
    commentId: notification.commentId ?? null,
    articleCommentId: notification.articleCommentId ?? null,
    type: notificationTypeAlias[notification.type] ?? notification.type,
    message: notification.message,
    createdAt: notification.createdAt,
    isRead: notification.read,
  };
}
