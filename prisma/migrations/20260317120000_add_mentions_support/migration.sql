DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'MENTION'
      AND enumtypid = 'NotificationType'::regtype
  ) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'MENTION';
  END IF;
END $$;

ALTER TABLE "Notification"
ADD COLUMN IF NOT EXISTS "actorId" TEXT,
ADD COLUMN IF NOT EXISTS "postId" TEXT,
ADD COLUMN IF NOT EXISTS "commentId" TEXT,
ADD COLUMN IF NOT EXISTS "articleCommentId" TEXT;

CREATE TABLE IF NOT EXISTS "Mention" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "postId" TEXT,
  "commentId" TEXT,
  "articleCommentId" TEXT,

  CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_actorId_fkey'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_postId_fkey'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_commentId_fkey'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_articleCommentId_fkey'
  ) THEN
    ALTER TABLE "Notification"
    ADD CONSTRAINT "Notification_articleCommentId_fkey"
    FOREIGN KEY ("articleCommentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Mention_userId_fkey'
  ) THEN
    ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Mention_actorId_fkey'
  ) THEN
    ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Mention_postId_fkey'
  ) THEN
    ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Mention_commentId_fkey'
  ) THEN
    ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_commentId_fkey"
    FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Mention_articleCommentId_fkey'
  ) THEN
    ALTER TABLE "Mention"
    ADD CONSTRAINT "Mention_articleCommentId_fkey"
    FOREIGN KEY ("articleCommentId") REFERENCES "ArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Notification_actorId_createdAt_idx"
ON "Notification"("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_postId_createdAt_idx"
ON "Notification"("postId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_commentId_createdAt_idx"
ON "Notification"("commentId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_articleCommentId_createdAt_idx"
ON "Notification"("articleCommentId", "createdAt");

CREATE INDEX IF NOT EXISTS "Mention_userId_createdAt_idx"
ON "Mention"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Mention_actorId_createdAt_idx"
ON "Mention"("actorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Mention_postId_createdAt_idx"
ON "Mention"("postId", "createdAt");

CREATE INDEX IF NOT EXISTS "Mention_commentId_createdAt_idx"
ON "Mention"("commentId", "createdAt");

CREATE INDEX IF NOT EXISTS "Mention_articleCommentId_createdAt_idx"
ON "Mention"("articleCommentId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Mention_postId_userId_key"
ON "Mention"("postId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Mention_commentId_userId_key"
ON "Mention"("commentId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "Mention_articleCommentId_userId_key"
ON "Mention"("articleCommentId", "userId");
