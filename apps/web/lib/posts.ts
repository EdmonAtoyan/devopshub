import type { PostCardData } from "@/components/post-card";
import { toGifAttachment } from "@/lib/gifs";

export type PostViewerState = {
  liked: boolean;
  bookmarked: boolean;
  reposted: boolean;
};

export type PostActionType = "like" | "bookmark" | "repost";

type InteractionCounts = {
  likes: number;
  comments: number;
  bookmarks: number;
  reposts: number;
};

type InteractionCarrier = {
  id: string;
  viewCount: number;
  author: { id?: string; username: string; verified?: boolean; name?: string };
  body: string;
  gifUrl?: string | null;
  gifAlt?: string | null;
  createdAt: string;
  tags: { tag: { name: string } }[];
  _count: InteractionCounts;
  viewer: PostViewerState;
  originalPost?: InteractionCarrier | null;
  [key: string]: unknown;
};

export function toPostCardData(post: InteractionCarrier, commentCount?: number): PostCardData {
  return {
    id: post.id,
    body: post.body,
    gif: toGifAttachment(post),
    createdAt: post.createdAt,
    author: post.author,
    tags: post.tags.map((entry) => ({ name: entry.tag.name })),
    counts: {
      likes: post._count.likes,
      comments: commentCount ?? post._count.comments,
      bookmarks: post._count.bookmarks,
      reposts: post._count.reposts,
    },
    viewCount: post.viewCount,
    viewer: post.viewer,
  };
}

export function applyPostInteraction<T extends InteractionCarrier>(
  post: T,
  targetId: string,
  action: PostActionType,
  nextActive?: boolean,
): T {
  if (post.id === targetId) {
    return updateSubject(post, action, nextActive) as T;
  }

  if (post.originalPost?.id === targetId) {
    return {
      ...post,
      originalPost: updateSubject(post.originalPost, action, nextActive),
    } as T;
  }

  return post;
}

function updateSubject<T extends InteractionCarrier>(
  post: T,
  action: PostActionType,
  nextActive?: boolean,
) {
  const viewerKey = actionToViewerKey(action);
  const countKey = actionToCountKey(action);
  const currentActive = post.viewer?.[viewerKey] ?? false;
  const resolvedActive = nextActive ?? !currentActive;
  const delta = resolvedActive === currentActive ? 0 : resolvedActive ? 1 : -1;

  return {
    ...post,
    _count: {
      ...post._count,
      [countKey]: Math.max(0, (post._count?.[countKey] ?? 0) + delta),
    },
    viewer: {
      liked: post.viewer?.liked ?? false,
      bookmarked: post.viewer?.bookmarked ?? false,
      reposted: post.viewer?.reposted ?? false,
      [viewerKey]: resolvedActive,
    },
  };
}

function actionToViewerKey(action: PostActionType) {
  if (action === "like") return "liked" as const;
  if (action === "bookmark") return "bookmarked" as const;
  return "reposted" as const;
}

function actionToCountKey(action: PostActionType) {
  if (action === "like") return "likes" as const;
  if (action === "bookmark") return "bookmarks" as const;
  return "reposts" as const;
}
