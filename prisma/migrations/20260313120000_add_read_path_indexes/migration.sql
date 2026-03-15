CREATE INDEX IF NOT EXISTS "User_reputation_createdAt_idx"
ON "User"("reputation", "createdAt");

CREATE INDEX IF NOT EXISTS "Post_authorId_createdAt_idx"
ON "Post"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Post_createdAt_idx"
ON "Post"("createdAt");

CREATE INDEX IF NOT EXISTS "Post_likeCount_createdAt_idx"
ON "Post"("likeCount", "createdAt");

CREATE INDEX IF NOT EXISTS "Article_authorId_createdAt_idx"
ON "Article"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Article_createdAt_idx"
ON "Article"("createdAt");

CREATE INDEX IF NOT EXISTS "Article_likeCount_createdAt_idx"
ON "Article"("likeCount", "createdAt");

CREATE INDEX IF NOT EXISTS "Snippet_authorId_createdAt_idx"
ON "Snippet"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Snippet_language_createdAt_idx"
ON "Snippet"("language", "createdAt");

CREATE INDEX IF NOT EXISTS "Tool_category_popularityScore_idx"
ON "Tool"("category", "popularityScore");

CREATE INDEX IF NOT EXISTS "Tag_followerCount_createdAt_idx"
ON "Tag"("followerCount", "createdAt");

CREATE INDEX IF NOT EXISTS "Comment_postId_createdAt_idx"
ON "Comment"("postId", "createdAt");

CREATE INDEX IF NOT EXISTS "Comment_authorId_createdAt_idx"
ON "Comment"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "ArticleComment_articleId_createdAt_idx"
ON "ArticleComment"("articleId", "createdAt");

CREATE INDEX IF NOT EXISTS "ArticleComment_authorId_createdAt_idx"
ON "ArticleComment"("authorId", "createdAt");

CREATE INDEX IF NOT EXISTS "Follow_followeeId_createdAt_idx"
ON "Follow"("followeeId", "createdAt");

CREATE INDEX IF NOT EXISTS "TagFollow_tagId_createdAt_idx"
ON "TagFollow"("tagId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx"
ON "Notification"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "Notification_userId_read_createdAt_idx"
ON "Notification"("userId", "read", "createdAt");

CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_expiresAt_idx"
ON "PasswordResetToken"("userId", "expiresAt");
