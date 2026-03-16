"use client";

import { AutoLinkedText } from "@/components/auto-linked-text";
import { GifAttachment } from "@/components/gif-attachment";
import { PostCard } from "@/components/post-card";
import { PixelInfinityLoader } from "@/components/pixel-infinity-loader";
import { Shell } from "@/components/shell";
import { UsernameInline } from "@/components/verified-badge";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { toGifAttachment } from "@/lib/gifs";
import { applyPostInteraction, type PostActionType, type PostViewerState, toPostCardData } from "@/lib/posts";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type FeedComment = {
  id: string;
  body: string;
  gifUrl?: string | null;
  gifAlt?: string | null;
  createdAt: string;
  parentId?: string | null;
  author: { id: string; username: string; verified?: boolean; name: string };
  replies?: FeedComment[];
};

type FeedPostContent = {
  id: string;
  body: string;
  gifUrl?: string | null;
  gifAlt?: string | null;
  createdAt: string;
  viewCount: number;
  author: { id: string; username: string; verified?: boolean; name: string };
  tags: { tag: { name: string } }[];
  comments: FeedComment[];
  _count: { likes: number; comments: number; bookmarks: number; reposts: number };
  viewer: PostViewerState;
};

type FeedItem = FeedPostContent & {
  originalPost?: FeedPostContent | null;
};

export default function FeedPostPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [post, setPost] = useState<FeedItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [me, setMe] = useState<CurrentUser>(null);
  const [pendingActions, setPendingActions] = useState<Partial<Record<PostActionType, boolean>>>({});
  const trackedViewRef = useRef(false);
  const meId = me?.id ?? "";
  const showGifs = me?.showGifs !== false;

  useEffect(() => {
    trackedViewRef.current = false;
  }, [id]);

  useEffect(() => {
    void getCurrentUser()
      .then((user) => setMe(user))
      .catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<FeedItem | null>(`feed/${id}?commentLimit=20`);
        if (!cancelled) {
          setPost(data ? hydrateFeedItem(data) : null);
          setError(data ? "" : "Post not found.");
        }
      } catch {
        if (!cancelled) {
          setPost(null);
          setError("Could not load post.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!post || trackedViewRef.current) return;
    trackedViewRef.current = true;
    void apiRequest(`feed/${id}/view`, { method: "POST" }).catch(() => undefined);
  }, [id, post]);

  const commentCount = useMemo(() => {
    if (!post) return 0;
    const subject = post.originalPost || post;
    return countComments(subject.comments);
  }, [post]);

  if (loading) {
    return (
      <Shell>
        <section className="page-section">
          <PixelInfinityLoader label="Loading post..." />
        </section>
      </Shell>
    );
  }

  if (!post) {
    return (
      <Shell>
        <section className="page-section space-y-3">
          <p className="text-base text-danger-soft">{error || "Post not found."}</p>
          <Link href="/feed" className="post-link-button w-fit">
            Back to feed
          </Link>
        </section>
      </Shell>
    );
  }

  const subject = post.originalPost || post;
  const canRepost = !!meId && meId !== subject.author.id;

  const interact = async (postId: string, action: PostActionType) => {
    if (!meId || pendingActions[action]) {
      if (!meId) {
        setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
      }
      return;
    }

    const previousActive = getInteractionState(post, postId, action);
    setPendingActions((current) => ({ ...current, [action]: true }));
    setPost((current) => (current ? applyPostInteraction(current, postId, action) : current));

    try {
      if (action === "repost") {
        const result = await apiRequest<{ reposted: boolean }>(`feed/${postId}/repost`, { method: "POST" });
        setPost((current) => (current ? applyPostInteraction(current, postId, action, result.reposted) : current));
        if (!result.reposted && post.originalPost && post.author.id === meId) {
          router.replace(`/feed/${post.originalPost.id}`);
          return;
        }
      } else if (action === "like") {
        const result = await apiRequest<{ liked: boolean }>(`feed/${postId}/like`, { method: "POST" });
        setPost((current) => (current ? applyPostInteraction(current, postId, action, result.liked) : current));
      } else {
        const result = await apiRequest<{ bookmarked: boolean }>(`feed/${postId}/bookmark`, { method: "POST" });
        setPost((current) => (current ? applyPostInteraction(current, postId, action, result.bookmarked) : current));
      }
      setError("");
    } catch {
      setPost((current) => (current ? applyPostInteraction(current, postId, action, previousActive) : current));
      setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
    } finally {
      setPendingActions((current) => ({ ...current, [action]: false }));
    }
  };

  return (
    <Shell>
      <section className="page-header page-enter">
        <div className="page-header-bar">
          <div className="page-header-copy">
            <h1 className="page-title">Thread view</h1>
            <p className="page-lead">
              A focused view of the original content and its discussion, without the rest of the feed competing for attention.
            </p>
          </div>
          <Link href="/feed" className="post-link-button w-fit self-start">
            Back to feed
          </Link>
        </div>
      </section>

      <PostCard
        className="page-section page-enter"
        post={toPostCardData(subject, commentCount)}
        showGifs={showGifs}
        context={
          post.originalPost
            ? {
                label: "Reposted by",
                username: post.author.username,
                verified: post.author.verified,
                createdAt: post.createdAt,
              }
            : undefined
        }
        onLike={() => void interact(subject.id, "like")}
        onBookmark={() => void interact(subject.id, "bookmark")}
        onRepost={canRepost ? () => void interact(subject.id, "repost") : undefined}
        disabledActions={pendingActions}
      >
        <div className="mt-6 space-y-3 border-t border-line pt-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="section-heading text-base">Discussion</h2>
            <p className="text-xs text-slate-500">{commentCount} comments</p>
          </div>

          {subject.comments.length === 0 ? (
            <p className="subtle-panel text-sm text-slate-400">No comments yet.</p>
          ) : (
            subject.comments.map((comment) => (
              <CommentThread key={comment.id} comment={comment} showGifs={showGifs} />
            ))
          )}
        </div>
      </PostCard>
    </Shell>
  );
}

function CommentThread({ comment, showGifs }: { comment: FeedComment; showGifs: boolean }) {
  const commentGif = toGifAttachment(comment);

  return (
    <div className="subtle-panel p-4">
      <p className="text-sm leading-6 text-slate-300">
        <UsernameInline className="font-medium text-slate-100" username={comment.author.username} verified={comment.author.verified} />{" "}
        {new Date(comment.createdAt).toLocaleString()}
      </p>
      <p className="content-wrap mt-2 text-sm leading-6 text-slate-300">
        <AutoLinkedText text={comment.body} />
      </p>
      {commentGif ? <GifAttachment gif={commentGif} showByDefault={showGifs} className="mt-3" /> : null}

      {comment.replies?.length ? (
        <div className="comment-thread mt-4 space-y-3">
          {comment.replies.map((reply) => {
            const replyGif = toGifAttachment(reply);

            return (
              <div key={reply.id} className="subtle-panel p-4 sm:ml-2">
                <p className="text-sm leading-6 text-slate-300">
                  <UsernameInline className="font-medium text-slate-100" username={reply.author.username} verified={reply.author.verified} />{" "}
                  {new Date(reply.createdAt).toLocaleString()}
                </p>
                <p className="content-wrap mt-2 text-sm leading-6 text-slate-300">
                  <AutoLinkedText text={reply.body} />
                </p>
                {replyGif ? <GifAttachment gif={replyGif} showByDefault={showGifs} className="mt-3" /> : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function parseReplyBody(body: string) {
  const match = body.match(/^@reply:([a-zA-Z0-9_-]+)\n([\s\S]*)$/);
  if (!match) return { parentId: null as string | null, text: body };
  return { parentId: match[1], text: match[2] };
}

function hydrateFeedPostContent(post: FeedPostContent): FeedPostContent {
  return {
    ...post,
    comments: buildThreadedComments(post.comments || []),
  };
}

function hydrateFeedItem(post: FeedItem): FeedItem {
  return {
    ...hydrateFeedPostContent(post),
    originalPost: post.originalPost ? hydrateFeedPostContent(post.originalPost) : null,
  };
}

function buildThreadedComments(comments: FeedComment[]) {
  const byId = new Map<string, FeedComment>();
  const roots: FeedComment[] = [];

  const normalized = comments.map((comment) => {
    const parsed = parseReplyBody(comment.body);
    return {
      ...comment,
      body: parsed.text,
      parentId: parsed.parentId,
      replies: [],
    };
  });

  normalized.forEach((comment) => {
    byId.set(comment.id, comment);
  });

  normalized.forEach((comment) => {
    if (comment.parentId && byId.has(comment.parentId)) {
      byId.get(comment.parentId)?.replies?.push(comment);
    } else {
      roots.push(comment);
    }
  });

  roots.forEach((root) => {
    root.replies = (root.replies || []).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  });

  return roots;
}

function countComments(comments: FeedComment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies || []), 0);
}

function getInteractionState(post: FeedItem | null, targetId: string, action: PostActionType) {
  if (!post) {
    return false;
  }

  const subject = post.id === targetId ? post : post.originalPost?.id === targetId ? post.originalPost : null;
  if (!subject) {
    return false;
  }

  if (action === "like") return subject.viewer.liked;
  if (action === "bookmark") return subject.viewer.bookmarked;
  return subject.viewer.reposted;
}
