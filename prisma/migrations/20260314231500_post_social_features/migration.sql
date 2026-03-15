ALTER TABLE "Post"
ADD COLUMN IF NOT EXISTS "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "repostCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "originalPostId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Post_originalPostId_fkey'
  ) THEN
    ALTER TABLE "Post"
    ADD CONSTRAINT "Post_originalPostId_fkey"
    FOREIGN KEY ("originalPostId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Post_originalPostId_createdAt_idx"
ON "Post"("originalPostId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Post_authorId_originalPostId_key"
ON "Post"("authorId", "originalPostId");

CREATE INDEX IF NOT EXISTS "PostBookmark_userId_createdAt_idx"
ON "PostBookmark"("userId", "createdAt");

CREATE TABLE IF NOT EXISTS "PostView" (
  "id" TEXT NOT NULL,
  "postId" TEXT NOT NULL,
  "userId" TEXT,
  "viewerHash" TEXT,
  "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PostView_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PostView_postId_fkey'
  ) THEN
    ALTER TABLE "PostView"
    ADD CONSTRAINT "PostView_postId_fkey"
    FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PostView_userId_fkey'
  ) THEN
    ALTER TABLE "PostView"
    ADD CONSTRAINT "PostView_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "PostView_postId_userId_key"
ON "PostView"("postId", "userId");

CREATE UNIQUE INDEX IF NOT EXISTS "PostView_postId_viewerHash_key"
ON "PostView"("postId", "viewerHash");

CREATE INDEX IF NOT EXISTS "PostView_postId_lastViewedAt_idx"
ON "PostView"("postId", "lastViewedAt");

CREATE INDEX IF NOT EXISTS "PostView_userId_lastViewedAt_idx"
ON "PostView"("userId", "lastViewedAt");
