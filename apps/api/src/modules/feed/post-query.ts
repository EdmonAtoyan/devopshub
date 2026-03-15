import { PrismaService } from "../../prisma.service";

const postAuthorSelect = {
  id: true,
  username: true,
  verified: true,
  name: true,
} as const;

type PostRecord = {
  id: string;
  _count: {
    likes: number;
    comments: number;
    bookmarks: number;
  };
  [key: string]: unknown;
};

type PostSocialMetadata = {
  id: string;
  viewCount: number;
  repostCount: number;
  originalPostId: string | null;
};

type PostViewerState = {
  liked: boolean;
  bookmarked: boolean;
  reposted: boolean;
};

function buildCommentInclude(commentLimit: number) {
  return {
    orderBy: { createdAt: "desc" },
    take: commentLimit,
    include: {
      author: { select: postAuthorSelect },
    },
  };
}

export function buildPostInclude(commentLimit: number) {
  return {
    author: { select: postAuthorSelect },
    tags: { select: { tag: { select: { name: true } } } },
    comments: buildCommentInclude(commentLimit),
    _count: { select: { likes: true, comments: true, bookmarks: true } },
  };
}

export async function enrichPosts(
  prisma: PrismaService,
  posts: PostRecord[],
  commentLimit: number,
  viewerId?: string | null,
) {
  if (posts.length === 0) {
    return [];
  }

  const postMetadata = await loadPostMetadata(prisma, posts.map((post) => post.id));
  const originalIds = Array.from(
    new Set(
      Array.from(postMetadata.values() as Iterable<PostSocialMetadata>)
        .map((entry) => entry.originalPostId)
        .filter((value): value is string => !!value),
    ),
  );
  const viewerState = await loadViewerState(prisma, [...posts.map((post) => post.id), ...originalIds], viewerId);

  const originalPosts = originalIds.length
    ? ((await prisma.post.findMany({
        where: { id: { in: originalIds } },
        include: buildPostInclude(commentLimit),
      })) as PostRecord[])
    : [];
  const originalMetadata = await loadPostMetadata(prisma, originalIds);

  const originalMap = new Map<string, PostRecord>(
    originalPosts.map((post) => [
      post.id,
      attachMetadata(
        post,
        (originalMetadata.get(post.id) as PostSocialMetadata | undefined) ?? null,
        null,
        viewerState,
      ),
    ]),
  );

  return posts.map((post) =>
    attachMetadata(
      post,
      (postMetadata.get(post.id) as PostSocialMetadata | undefined) ?? null,
      originalMap,
      viewerState,
    ),
  );
}

async function loadPostMetadata(prisma: PrismaService, ids: string[]) {
  if (ids.length === 0) {
    return new Map<string, PostSocialMetadata>();
  }

  const idList = ids.map((id) => `'${escapeSql(id)}'`).join(", ");
  const rows = (await prisma.$queryRawUnsafe(
    `
      SELECT "id", "viewCount", "repostCount", "originalPostId"
      FROM "Post"
      WHERE "id" IN (${idList})
    `,
  )) as PostSocialMetadata[];

  return new Map(rows.map((row: PostSocialMetadata) => [row.id, row]));
}

async function loadViewerState(prisma: PrismaService, ids: string[], viewerId?: string | null) {
  const uniqueIds = Array.from(new Set(ids));
  if (!viewerId || uniqueIds.length === 0) {
    return new Map<string, PostViewerState>();
  }

  const [likes, bookmarks, reposts] = await Promise.all([
    prisma.postLike.findMany({
      where: {
        userId: viewerId,
        postId: { in: uniqueIds },
      },
      select: { postId: true },
    }),
    prisma.postBookmark.findMany({
      where: {
        userId: viewerId,
        postId: { in: uniqueIds },
      },
      select: { postId: true },
    }),
    prisma.post.findMany({
      where: {
        authorId: viewerId,
        originalPostId: { in: uniqueIds },
      },
      select: { originalPostId: true },
    }),
  ]);

  const byId = new Map<string, PostViewerState>(
    uniqueIds.map((id) => [
      id,
      {
        liked: false,
        bookmarked: false,
        reposted: false,
      },
    ]),
  );

  likes.forEach((entry: { postId: string }) => {
    const current = byId.get(entry.postId);
    if (current) {
      current.liked = true;
    }
  });

  bookmarks.forEach((entry: { postId: string }) => {
    const current = byId.get(entry.postId);
    if (current) {
      current.bookmarked = true;
    }
  });

  reposts.forEach((entry: { originalPostId: string | null }) => {
    if (!entry.originalPostId) return;
    const current = byId.get(entry.originalPostId);
    if (current) {
      current.reposted = true;
    }
  });

  return byId;
}

function attachMetadata(
  post: PostRecord,
  metadata: PostSocialMetadata | null,
  originalMap: Map<string, PostRecord> | null,
  viewerState: Map<string, PostViewerState>,
) {
  return {
    ...post,
    viewCount: metadata?.viewCount ?? 0,
    _count: {
      ...post._count,
      reposts: metadata?.repostCount ?? 0,
    },
    viewer: viewerState.get(post.id) ?? {
      liked: false,
      bookmarked: false,
      reposted: false,
    },
    originalPost: metadata?.originalPostId ? originalMap?.get(metadata.originalPostId) ?? null : null,
  };
}

function escapeSql(value: string) {
  return value.replace(/'/g, "''");
}
