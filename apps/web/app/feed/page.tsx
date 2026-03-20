"use client";

export const dynamic = "force-dynamic";

import { AutoLinkedText } from "@/components/auto-linked-text";
import { EmojiTextEditor } from "@/components/emoji-text-editor";
import { GifAttachment } from "@/components/gif-attachment";
import { Shell } from "@/components/shell";
import { MoreHorizontalIcon } from "@/components/icons";
import { PostCard } from "@/components/post-card";
import { PixelInfinityLoader } from "@/components/pixel-infinity-loader";
import { UsernameInline } from "@/components/verified-badge";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { hasComposerContent, toGifAttachment, toGifPayload, type GifAttachment as GifAttachmentValue } from "@/lib/gifs";
import { applyPostInteraction, type PostActionType, type PostViewerState, toPostCardData } from "@/lib/posts";
import { createTextPreview } from "@/lib/preview";
import { connectRealtime, type SocketLike } from "@/lib/realtime";
import { FormEvent, useEffect, useRef, useState } from "react";

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

type FeedSort = "latest" | "likes" | "comments";

const POST_BODY_MAX_LENGTH = 10_000;

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [body, setBody] = useState("");
  const [postGif, setPostGif] = useState<GifAttachmentValue | null>(null);
  const [error, setError] = useState("");
  const [me, setMe] = useState<CurrentUser>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; body: string; gif: GifAttachmentValue | null } | null>(null);
  const [newCommentByPost, setNewCommentByPost] = useState<Record<string, string>>({});
  const [newCommentGifByPost, setNewCommentGifByPost] = useState<Record<string, GifAttachmentValue | null>>({});
  const [editingComment, setEditingComment] = useState<Record<string, string>>({});
  const [editingCommentGif, setEditingCommentGif] = useState<Record<string, GifAttachmentValue | null>>({});
  const [replyOpenByComment, setReplyOpenByComment] = useState<Record<string, boolean>>({});
  const [replyByComment, setReplyByComment] = useState<Record<string, string>>({});
  const [replyGifByComment, setReplyGifByComment] = useState<Record<string, GifAttachmentValue | null>>({});
  const [sort, setSort] = useState<FeedSort>("latest");
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState<string | null>(null);
  const [pendingActions, setPendingActions] = useState<Record<string, Partial<Record<PostActionType, boolean>>>>({});
  const trackedViewsRef = useRef<Set<string>>(new Set());

  const meId = me?.id ?? "";
  const showGifs = me?.showGifs !== false;

  const loadMe = async () => {
    try {
      setMe(await getCurrentUser());
    } catch {
      setMe(null);
    }
  };

  const load = async (nextSort: FeedSort = sort) => {
    setFeedLoading(true);
    try {
      const data = await apiRequest<FeedItem[]>(`feed?sort=${nextSort}&limit=30&commentLimit=12`);
      setPosts(data.map(hydrateFeedItem));
      setError("");
    } catch {
      setError("Could not load feed. Ensure API is running.");
    } finally {
      setFeedLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void loadMe();
  }, [sort]);

  useEffect(() => {
    let mounted = true;
    let socket: SocketLike | null = null;

    const onNewPost = (post: FeedItem) => {
      if (!mounted || sort !== "latest") return;
      setPosts((prev) => {
        const nextPost = hydrateFeedItem(post);
        if (prev.some((item) => item.id === nextPost.id)) return prev;
        return [nextPost, ...prev].slice(0, 50);
      });
    };

    const setup = async () => {
      socket = await connectRealtime();
      if (!socket || !mounted) return;
      socket.on("new_post", onNewPost);
    };
    void setup();

    return () => {
      mounted = false;
      if (socket) {
        socket.off("new_post", onNewPost);
        socket.disconnect();
      }
    };
  }, [sort]);

  useEffect(() => {
    const targets = Array.from(
      new Set(posts.map((post) => (post.originalPost || post).id).filter((id) => !trackedViewsRef.current.has(id))),
    );

    if (targets.length === 0) {
      return;
    }

    targets.forEach((id) => {
      trackedViewsRef.current.add(id);
      void apiRequest<{ counted: boolean; viewCount: number }>(`feed/${id}/view`, { method: "POST" })
        .then((result) => {
          setPosts((current) => current.map((post) => updateFeedItemViewCount(post, id, result.viewCount)));
        })
        .catch(() => undefined);
    });
  }, [posts]);

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!hasComposerContent(body, postGif)) return;

    try {
      await apiRequest("feed", {
        method: "POST",
        body: JSON.stringify({ body, ...toGifPayload(postGif) }),
      });
      setBody("");
      setPostGif(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish post.");
    }
  };

  const interact = async (id: string, action: PostActionType) => {
    if (!meId) {
      setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
      return;
    }
    if (pendingActions[id]?.[action]) {
      return;
    }

    const previousActive = getInteractionState(posts, id, action);
    setPendingActions((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [action]: true,
      },
    }));
    setPosts((current) => current.map((post) => applyPostInteraction(post, id, action)));

    try {
      if (action === "repost") {
        const result = await apiRequest<{ reposted: boolean; post?: FeedItem | null }>(`feed/${id}/${action}`, { method: "POST" });
        setPosts((current) => {
          let next = current.map((post) => applyPostInteraction(post, id, action, result.reposted));
          if (result.reposted && result.post && sort === "latest") {
            const repostPost = hydrateFeedItem(result.post);
            if (!next.some((entry) => entry.id === repostPost.id)) {
              next = [repostPost, ...next].slice(0, 50);
            }
          }
          if (!result.reposted) {
            next = next.filter((entry) => !(entry.author.id === meId && entry.originalPost?.id === id));
          }
          return next;
        });
      } else if (action === "like") {
        const result = await apiRequest<{ liked: boolean }>(`feed/${id}/${action}`, { method: "POST" });
        setPosts((current) => current.map((post) => applyPostInteraction(post, id, action, result.liked)));
      } else {
        const result = await apiRequest<{ bookmarked: boolean }>(`feed/${id}/${action}`, { method: "POST" });
        setPosts((current) => current.map((post) => applyPostInteraction(post, id, action, result.bookmarked)));
      }
      setError("");
    } catch {
      setPosts((current) => current.map((post) => applyPostInteraction(post, id, action, previousActive)));
      setError(action === "repost" ? "Login is required to repost." : "Login is required for this action.");
    } finally {
      setPendingActions((current) => {
        const next = {
          ...current,
          [id]: {
            ...current[id],
            [action]: false,
          },
        };
        if (!next[id]?.like && !next[id]?.bookmark && !next[id]?.repost) {
          delete next[id];
        }
        return next;
      });
    }
  };

  const removePost = async (id: string) => {
    try {
      await apiRequest(`feed/${id}`, { method: "DELETE" });
      setMenuFor(null);
      await load();
    } catch {
      setError("You can only delete your own posts.");
    }
  };

  const savePostEdit = async () => {
    if (!editingPost) return;
    try {
      await apiRequest(`feed/${editingPost.id}`, {
        method: "PATCH",
        body: JSON.stringify({ body: editingPost.body, ...toGifPayload(editingPost.gif) }),
      });
      setEditingPost(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update post.");
    }
  };

  const addComment = async (postId: string) => {
    const value = (newCommentByPost[postId] || "").trim();
    const gif = newCommentGifByPost[postId] || null;
    if (!hasComposerContent(value, gif)) return;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments`, {
        method: "POST",
        body: JSON.stringify({ postId, body: value, ...toGifPayload(gif) }),
      });
      setNewCommentByPost((prev) => ({ ...prev, [postId]: "" }));
      setNewCommentGifByPost((prev) => ({ ...prev, [postId]: null }));
      await load();
    } catch {
      setError("Login is required to comment.");
    } finally {
      setCommentsLoadingPostId((current) => (current === postId ? null : current));
    }
  };

  const addReply = async (postId: string, parentId: string) => {
    const value = (replyByComment[parentId] || "").trim();
    const gif = replyGifByComment[parentId] || null;
    if (!hasComposerContent(value, gif)) return;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments`, {
        method: "POST",
        body: JSON.stringify({ postId, body: value, parentId, ...toGifPayload(gif) }),
      });
      setReplyByComment((prev) => ({ ...prev, [parentId]: "" }));
      setReplyGifByComment((prev) => ({ ...prev, [parentId]: null }));
      setReplyOpenByComment((prev) => ({ ...prev, [parentId]: false }));
      await load();
    } catch {
      setError("Login is required to reply.");
    } finally {
      setCommentsLoadingPostId((current) => (current === postId ? null : current));
    }
  };

  const saveCommentEdit = async (commentId: string, postId: string, parentId?: string | null) => {
    const value = (editingComment[commentId] || "").trim();
    const gif = editingCommentGif[commentId] || null;
    if (!hasComposerContent(value, gif)) return;
    const body = parentId ? `@reply:${parentId}\n${value}` : value;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments/${commentId}`, {
        method: "PATCH",
        body: JSON.stringify({ body, ...toGifPayload(gif) }),
      });
      setEditingComment((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      setEditingCommentGif((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      await load();
    } catch {
      setError("Could not edit comment.");
    } finally {
      setCommentsLoadingPostId((current) => (current === postId ? null : current));
    }
  };

  const deleteComment = async (commentId: string, postId: string) => {
    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments/${commentId}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Could not delete comment.");
    } finally {
      setCommentsLoadingPostId((current) => (current === postId ? null : current));
    }
  };

  return (
    <Shell>
      <section className="page-header page-enter">
        <div className="page-header-bar feed-header-bar">
          <div className="page-header-copy feed-header-copy">
            <h1 className="page-title">Community updates</h1>
            <p className="page-lead">
              Fast-moving discussion belongs here first. Short operational updates, lessons learned, and follow-up comments stay in one readable stream.
            </p>
          </div>
          <div className="feed-sort-control">
            <label htmlFor="feed-sort" className="feed-sort-label">
              Sort by
            </label>
            <select
              id="feed-sort"
              className="sort-select feed-sort-select"
              value={sort}
              onChange={(event) => setSort(event.target.value as FeedSort)}
            >
              <option value="latest">Latest</option>
              <option value="likes">Most Liked</option>
              <option value="comments">Most Commented</option>
            </select>
          </div>
        </div>
      </section>

      <section className="page-section page-enter">
        <div className="space-y-4">
          <div>
            <h2 className="section-heading">Start a post</h2>
            <p className="section-copy mt-1">Lead with the key operational detail so readers can decide quickly whether to open the full thread.</p>
          </div>

          <form className="space-y-4" onSubmit={createPost}>
            <EmojiTextEditor
              multiline
              className="input min-h-32"
              placeholder="Share an incident lesson, IaC pattern, or deployment update..."
              value={body}
              maxLength={POST_BODY_MAX_LENGTH}
              onValueChange={setBody}
              enableMentions
              enableGifPicker
              gif={postGif}
              onGifSelect={setPostGif}
            />
            <div className="form-actions">
              <button className="btn-primary w-full sm:w-auto">Post</button>
            </div>
          </form>
        </div>
        {error ? <p className="mt-4 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {feedLoading && posts.length === 0 ? (
        <section className="page-section page-enter">
          <PixelInfinityLoader label="Loading feed..." />
        </section>
      ) : null}

      {posts.map((post) => {
        const subject = post.originalPost || post;
        const postId = subject.id;
        const isRepost = !!post.originalPost;
        const isAuthor = meId === post.author.id;
        const canRepost = meId !== subject.author.id;
        const expanded = !!expandedPosts[post.id];
        const preview = createTextPreview(subject.body);
        const showToggle = preview.truncated;

        return (
          <article key={post.id} className="page-enter">
            {editingPost?.id === post.id ? (
              <div className="page-section space-y-3">
                <EmojiTextEditor
                  multiline
                  className="input min-h-32"
                  value={editingPost.body}
                  maxLength={POST_BODY_MAX_LENGTH}
                  onValueChange={(nextBody) =>
                    setEditingPost((current) => (current ? { ...current, body: nextBody } : current))
                  }
                  enableMentions
                  enableGifPicker
                  gif={editingPost.gif}
                  onGifSelect={(nextGif) =>
                    setEditingPost((current) => (current ? { ...current, gif: nextGif } : current))
                  }
                />
                <div className="action-cluster">
                  <button type="button" className="btn-primary" onClick={() => void savePostEdit()}>
                    Save
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingPost(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <PostCard
                className="page-section"
                post={toPostCardData(subject)}
                context={
                  isRepost
                      ? {
                          label: "Reposted by",
                          username: post.author.username,
                          verified: post.author.verified,
                          createdAt: post.createdAt,
                        }
                      : undefined
                }
                headerAction={
                  isAuthor ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMenuFor(menuFor === post.id ? null : post.id)}
                        className="icon-button-subtle"
                        aria-label="Open post actions"
                        title="Post actions"
                      >
                        <MoreHorizontalIcon size={16} />
                      </button>
                      {menuFor === post.id ? (
                        <div className="menu-pop absolute right-0 z-10 mt-2 w-36 rounded-2xl border border-line bg-panel p-2">
                          {!isRepost ? (
                            <button
                              type="button"
                              className="w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-slate-800"
                              onClick={() => {
                                setEditingPost({ id: post.id, body: post.body, gif: toGifAttachment(post) });
                                setMenuFor(null);
                              }}
                            >
                              Edit
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`${isRepost ? "" : "mt-1 "}w-full rounded-xl px-3 py-2 text-left text-sm text-danger-soft hover:bg-slate-800`}
                            onClick={() => void removePost(post.id)}
                          >
                            {isRepost ? "Remove repost" : "Delete"}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null
                }
                body={expanded ? subject.body : preview.text}
                bodyClassName={expanded ? "h-auto max-h-none overflow-visible" : "max-h-64 overflow-hidden"}
                expanded={expanded}
                showToggle={showToggle}
                onToggleExpand={() => setExpandedPosts((prev) => ({ ...prev, [post.id]: !expanded }))}
                onLike={() => void interact(postId, "like")}
                onBookmark={() => void interact(postId, "bookmark")}
                onRepost={canRepost ? () => void interact(postId, "repost") : undefined}
                disabledActions={pendingActions[postId]}
                showGifs={showGifs}
              >
                <div className="mt-6 space-y-3 border-t border-line pt-5">
                  {commentsLoadingPostId === postId ? (
                    <div className="mb-2">
                      <PixelInfinityLoader compact label="Loading comments..." />
                    </div>
                  ) : null}

                  {subject.comments.map((comment) => {
                    const canEdit = meId === comment.author.id;
                    const editingValue = editingComment[comment.id];
                    const replyOpen = !!replyOpenByComment[comment.id];
                    const replies = comment.replies || [];
                    const commentGif = toGifAttachment(comment);

                    return (
                        <div key={comment.id} className="subtle-panel p-4">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <p className="text-sm leading-6 text-slate-300">
                              <UsernameInline className="font-medium text-slate-100" username={comment.author.username} verified={comment.author.verified} />{" "}
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          {canEdit ? (
                            <div className="flex flex-wrap gap-2 text-xs">
                              <button
                                type="button"
                                className="btn-secondary min-h-0 px-3 py-2 text-xs"
                                onClick={() => {
                                  setEditingComment((prev) => ({ ...prev, [comment.id]: comment.body }));
                                  setEditingCommentGif((prev) => ({ ...prev, [comment.id]: commentGif }));
                                }}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn-danger min-h-0 px-3 py-2 text-xs"
                                onClick={() => void deleteComment(comment.id, postId)}
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {editingValue !== undefined ? (
                          <div className="mt-3 space-y-3">
                            <EmojiTextEditor
                              multiline
                              className="input min-h-20"
                              value={editingValue}
                              onValueChange={(nextBody) => setEditingComment((prev) => ({ ...prev, [comment.id]: nextBody }))}
                              enableMentions
                              enableGifPicker
                              gif={editingCommentGif[comment.id] || null}
                              onGifSelect={(nextGif) =>
                                setEditingCommentGif((prev) => ({ ...prev, [comment.id]: nextGif }))
                              }
                            />
                            <div className="action-cluster">
                              <button type="button" className="btn-primary" onClick={() => void saveCommentEdit(comment.id, postId)}>
                                Save
                              </button>
                              <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => {
                                  setEditingComment((prev) => {
                                    const next = { ...prev };
                                    delete next[comment.id];
                                    return next;
                                  });
                                  setEditingCommentGif((prev) => {
                                    const next = { ...prev };
                                    delete next[comment.id];
                                    return next;
                                  });
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="content-wrap mt-2 text-sm leading-6 text-slate-300">
                              <AutoLinkedText text={comment.body} />
                            </p>
                            {commentGif ? <GifAttachment gif={commentGif} showByDefault={showGifs} className="mt-3" /> : null}
                          </>
                        )}

                        <div className="mt-3">
                          <button
                            type="button"
                            className="text-sm font-medium text-accent"
                            onClick={() =>
                              setReplyOpenByComment((prev) => ({ ...prev, [comment.id]: !replyOpen }))
                            }
                          >
                            {replyOpen ? "Cancel reply" : "Reply"}
                          </button>
                        </div>

                        {replyOpen ? (
                          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                            <EmojiTextEditor
                              className="input"
                              placeholder="Write a reply"
                              value={replyByComment[comment.id] || ""}
                              onValueChange={(nextBody) => setReplyByComment((prev) => ({ ...prev, [comment.id]: nextBody }))}
                              enableMentions
                              enableGifPicker
                              gif={replyGifByComment[comment.id] || null}
                              onGifSelect={(nextGif) =>
                                setReplyGifByComment((prev) => ({ ...prev, [comment.id]: nextGif }))
                              }
                            />
                            <button
                              type="button"
                              className="btn-secondary w-full sm:w-auto"
                              onClick={() => void addReply(postId, comment.id)}
                            >
                              Reply
                            </button>
                          </div>
                        ) : null}

                        {replies.length > 0 ? (
                          <div className="comment-thread mt-4 space-y-3">
                            {replies.map((reply) => {
                              const canEditReply = meId === reply.author.id;
                              const editingReplyValue = editingComment[reply.id];
                              const replyGif = toGifAttachment(reply);
                              return (
                                <div key={reply.id} className="subtle-panel p-4 sm:ml-2">
                                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <p className="text-sm leading-6 text-slate-300">
                                      <UsernameInline className="font-medium text-slate-100" username={reply.author.username} verified={reply.author.verified} />{" "}
                                      {new Date(reply.createdAt).toLocaleString()}
                                    </p>
                                    {canEditReply ? (
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        <button
                                          type="button"
                                          className="btn-secondary min-h-0 px-3 py-2 text-xs"
                                          onClick={() => {
                                            setEditingComment((prev) => ({ ...prev, [reply.id]: reply.body }));
                                            setEditingCommentGif((prev) => ({ ...prev, [reply.id]: replyGif }));
                                          }}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-danger min-h-0 px-3 py-2 text-xs"
                                          onClick={() => void deleteComment(reply.id, postId)}
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    ) : null}
                                  </div>
                                  {editingReplyValue !== undefined ? (
                                    <div className="mt-3 space-y-3">
                                      <EmojiTextEditor
                                        multiline
                                        className="input min-h-20"
                                        value={editingReplyValue}
                                        onValueChange={(nextBody) => setEditingComment((prev) => ({ ...prev, [reply.id]: nextBody }))}
                                        enableMentions
                                        enableGifPicker
                                        gif={editingCommentGif[reply.id] || null}
                                        onGifSelect={(nextGif) =>
                                          setEditingCommentGif((prev) => ({ ...prev, [reply.id]: nextGif }))
                                        }
                                      />
                                      <div className="action-cluster">
                                        <button
                                          type="button"
                                          className="btn-primary"
                                          onClick={() => void saveCommentEdit(reply.id, postId, comment.id)}
                                        >
                                          Save
                                        </button>
                                        <button
                                          type="button"
                                          className="btn-secondary"
                                          onClick={() => {
                                            setEditingComment((prev) => {
                                              const next = { ...prev };
                                              delete next[reply.id];
                                              return next;
                                            });
                                            setEditingCommentGif((prev) => {
                                              const next = { ...prev };
                                              delete next[reply.id];
                                              return next;
                                            });
                                          }}
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <p className="content-wrap mt-2 text-sm leading-6 text-slate-300">
                                        <AutoLinkedText text={reply.body} />
                                      </p>
                                      {replyGif ? <GifAttachment gif={replyGif} showByDefault={showGifs} className="mt-3" /> : null}
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <EmojiTextEditor
                      className="input"
                      placeholder="Add a comment"
                      value={newCommentByPost[postId] || ""}
                      onValueChange={(nextBody) => setNewCommentByPost((prev) => ({ ...prev, [postId]: nextBody }))}
                      enableMentions
                      enableGifPicker
                      gif={newCommentGifByPost[postId] || null}
                      onGifSelect={(nextGif) =>
                        setNewCommentGifByPost((prev) => ({ ...prev, [postId]: nextGif }))
                      }
                    />
                    <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => void addComment(postId)}>
                      Comment
                    </button>
                  </div>
                </div>
              </PostCard>
            )}
          </article>
        );
      })}
    </Shell>
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

function getInteractionState(posts: FeedItem[], targetId: string, action: PostActionType) {
  const subject = posts
    .map((post) => (post.id === targetId ? post : post.originalPost?.id === targetId ? post.originalPost : null))
    .find(Boolean);

  if (!subject) {
    return false;
  }

  if (action === "like") return subject.viewer.liked;
  if (action === "bookmark") return subject.viewer.bookmarked;
  return subject.viewer.reposted;
}

function updateFeedItemViewCount(post: FeedItem, targetId: string, viewCount: number): FeedItem {
  if (post.id === targetId) {
    return { ...post, viewCount };
  }

  if (post.originalPost?.id === targetId) {
    return {
      ...post,
      originalPost: {
        ...post.originalPost,
        viewCount,
      },
    };
  }

  return post;
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
