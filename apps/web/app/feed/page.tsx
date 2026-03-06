"use client";

import { Shell } from "@/components/shell";
import { PixelInfinityLoader } from "@/components/pixel-infinity-loader";
import { apiRequest, apiUrl } from "@/lib/api";
import { connectRealtime } from "@/lib/realtime";
import { FormEvent, useEffect, useMemo, useState } from "react";

type FeedComment = {
  id: string;
  body: string;
  createdAt: string;
  parentId?: string | null;
  author: { id: string; username: string; name: string };
  replies?: FeedComment[];
};

type FeedItem = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; name: string };
  tags: { tag: { name: string } }[];
  comments: FeedComment[];
  _count: { likes: number; comments: number; bookmarks: number };
};

type Me = { id: string; username: string } | null;
type FeedSort = "latest" | "likes" | "comments";

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<{ id: string; body: string } | null>(null);
  const [newCommentByPost, setNewCommentByPost] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<Record<string, string>>({});
  const [replyOpenByComment, setReplyOpenByComment] = useState<Record<string, boolean>>({});
  const [replyByComment, setReplyByComment] = useState<Record<string, string>>({});
  const [sort, setSort] = useState<FeedSort>("latest");
  const [expandedPosts, setExpandedPosts] = useState<Record<string, boolean>>({});
  const [feedLoading, setFeedLoading] = useState(false);
  const [commentsLoadingPostId, setCommentsLoadingPostId] = useState<string | null>(null);

  const meId = useMemo(() => me?.id ?? "", [me]);

  const loadMe = async () => {
    try {
      const response = await fetch(apiUrl("auth/me"), { credentials: "include" });
      if (!response.ok) {
        setMe(null);
        return;
      }
      const data = (await response.json()) as Me;
      setMe(data);
    } catch {
      setMe(null);
    }
  };

  const load = async (nextSort: FeedSort = sort) => {
    setFeedLoading(true);
    try {
      const data = await apiRequest<FeedItem[]>(`feed?sort=${nextSort}&limit=30&commentLimit=12`);
      setPosts(
        data.map((post) => ({
          ...post,
          comments: buildThreadedComments(post.comments || []),
        })),
      );
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
    let socket: {
      on: (event: string, cb: (...args: any[]) => void) => void;
      off: (event: string, cb?: (...args: any[]) => void) => void;
      disconnect: () => void;
    } | null = null;

    const onNewPost = (post: FeedItem) => {
      if (!mounted || sort !== "latest") return;
      setPosts((prev) => {
        if (prev.some((item) => item.id === post.id)) return prev;
        return [post, ...prev].slice(0, 50);
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

  const createPost = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;

    try {
      await apiRequest("feed", { method: "POST", body: JSON.stringify({ body }) });
      setBody("");
      await load();
    } catch {
      setError("You need to log in before posting.");
    }
  };

  const interact = async (id: string, action: "like" | "bookmark") => {
    try {
      await apiRequest(`feed/${id}/${action}`, { method: "POST" });
      await load();
    } catch {
      setError("Login is required for this action.");
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
        body: JSON.stringify({ body: editingPost.body }),
      });
      setEditingPost(null);
      await load();
    } catch {
      setError("Could not update post.");
    }
  };

  const addComment = async (postId: string) => {
    const value = (newCommentByPost[postId] || "").trim();
    if (!value) return;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments`, {
        method: "POST",
        body: JSON.stringify({ postId, body: value }),
      });
      setNewCommentByPost((prev) => ({ ...prev, [postId]: "" }));
      await load();
    } catch {
      setError("Login is required to comment.");
    } finally {
      setCommentsLoadingPostId((current) => (current === postId ? null : current));
    }
  };

  const addReply = async (postId: string, parentId: string) => {
    const value = (replyByComment[parentId] || "").trim();
    if (!value) return;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments`, {
        method: "POST",
        body: JSON.stringify({ postId, body: value, parentId }),
      });
      setReplyByComment((prev) => ({ ...prev, [parentId]: "" }));
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
    if (!value) return;
    const body = parentId ? `@reply:${parentId}\n${value}` : value;

    setCommentsLoadingPostId(postId);
    try {
      await apiRequest(`feed/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ body }) });
      setEditingComment((prev) => {
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
      <section className="card p-4 page-enter">
        <div className="mb-3 flex items-center justify-end">
          <label className="inline-flex items-center gap-2 text-xs text-slate-400">
            Sort
            <select
              className="sort-select rounded-lg border border-line bg-bg px-2 py-1 text-xs text-slate-200 outline-none focus:border-accent"
              value={sort}
              onChange={(event) => setSort(event.target.value as FeedSort)}
            >
              <option value="latest">Latest</option>
              <option value="likes">Most Liked</option>
              <option value="comments">Most Commented</option>
            </select>
          </label>
        </div>

        <form onSubmit={createPost}>
          <textarea
            className="input min-h-24"
            placeholder="Share an incident lesson, IaC pattern, or deployment update..."
            value={body}
            maxLength={280}
            onChange={(event) => setBody(event.target.value)}
          />
          <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
            <span>280 characters</span>
            <button className="btn-positive-solid rounded-lg px-4 py-2 text-sm font-semibold">Post</button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {feedLoading && posts.length === 0 ? (
        <section className="card p-4 page-enter">
          <PixelInfinityLoader label="Loading feed..." />
        </section>
      ) : null}

      {posts.map((post) => {
        const isAuthor = meId === post.author.id;
        const expanded = !!expandedPosts[post.id];
        const preview = createPreview(post.body);
        const showToggle = preview.truncated;

        return (
          <article key={post.id} className="card p-4 page-enter">
            <header className="flex items-start justify-between gap-3 text-sm text-slate-400">
              <div>
                <p className="font-semibold text-slate-100">@{post.author.username}</p>
                <p className="text-xs">{new Date(post.createdAt).toLocaleString()}</p>
              </div>

              {isAuthor ? (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuFor(menuFor === post.id ? null : post.id)}
                    className="rounded-lg border border-line px-2 py-1 text-xs"
                  >
                    ...
                  </button>
                  {menuFor === post.id ? (
                    <div className="menu-pop absolute right-0 z-10 mt-2 w-32 rounded-lg border border-line bg-panel p-1">
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1 text-left text-xs hover:bg-slate-800"
                        onClick={() => {
                          setEditingPost({ id: post.id, body: post.body });
                          setMenuFor(null);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-md px-2 py-1 text-left text-xs text-danger-soft hover:bg-slate-800"
                        onClick={() => void removePost(post.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </header>

            {editingPost?.id === post.id ? (
              <div className="mt-3 space-y-2">
                <textarea
                  className="input min-h-24"
                  value={editingPost.body}
                  onChange={(event) => setEditingPost({ id: post.id, body: event.target.value })}
                />
                <div className="flex gap-2 text-sm">
                  <button type="button" className="rounded-lg border border-line px-3 py-1" onClick={() => void savePostEdit()}>
                    Save
                  </button>
                  <button type="button" className="rounded-lg border border-line px-3 py-1" onClick={() => setEditingPost(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <p className={`whitespace-pre-wrap text-base leading-7 text-slate-200 transition-all duration-200 ${expanded ? "max-h-[1200px]" : "max-h-64 overflow-hidden"}`}>
                  {expanded ? post.body : preview.text}
                </p>
                {showToggle ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-accent"
                    onClick={() => setExpandedPosts((prev) => ({ ...prev, [post.id]: !expanded }))}
                  >
                    {expanded ? "↑ Show less" : "↓ Show more"}
                  </button>
                ) : null}
              </div>
            )}

            <div className="mt-2 flex flex-wrap gap-2 text-sm text-accent">
              {post.tags.map((entry) => (
                <span key={entry.tag.name} className="rounded-lg border border-line px-2 py-1">
                  #{entry.tag.name}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1" onClick={() => void interact(post.id, "like")}>
                Like {post._count.likes}
              </button>
              <button className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1" onClick={() => void interact(post.id, "bookmark")}>
                Bookmark {post._count.bookmarks}
              </button>
              <span className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-slate-400">
                Comments {post._count.comments}
              </span>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {commentsLoadingPostId === post.id ? (
                <div className="mb-2">
                  <PixelInfinityLoader compact label="Loading comments..." />
                </div>
              ) : null}

              {post.comments.map((comment) => {
                const canEdit = meId === comment.author.id;
                const editingValue = editingComment[comment.id];
                const replyOpen = !!replyOpenByComment[comment.id];
                const replies = comment.replies || [];

                return (
                  <div key={comment.id} className="rounded-lg border border-line bg-bg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-slate-300">
                        <span className="font-medium text-slate-100">@{comment.author.username}</span> {new Date(comment.createdAt).toLocaleString()}
                      </p>
                      {canEdit ? (
                        <div className="flex gap-1 text-xs">
                          <button
                            type="button"
                            className="rounded-md border border-line px-2 py-1"
                            onClick={() => setEditingComment((prev) => ({ ...prev, [comment.id]: comment.body }))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger rounded-md px-2 py-1"
                            onClick={() => void deleteComment(comment.id, post.id)}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>

                    {editingValue !== undefined ? (
                      <div className="mt-2 space-y-2">
                        <textarea
                          className="input min-h-20"
                          value={editingValue}
                          onChange={(event) =>
                            setEditingComment((prev) => ({
                              ...prev,
                              [comment.id]: event.target.value,
                            }))
                          }
                        />
                        <div className="flex gap-2 text-xs">
                          <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => void saveCommentEdit(comment.id, post.id)}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-line px-2 py-1"
                            onClick={() =>
                              setEditingComment((prev) => {
                                const next = { ...prev };
                                delete next[comment.id];
                                return next;
                              })
                            }
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-slate-300">{comment.body}</p>
                    )}

                    <div className="mt-2">
                      <button
                        type="button"
                        className="text-xs text-accent"
                        onClick={() =>
                          setReplyOpenByComment((prev) => ({ ...prev, [comment.id]: !replyOpen }))
                        }
                      >
                        {replyOpen ? "Cancel reply" : "Reply"}
                      </button>
                    </div>

                    {replyOpen ? (
                      <div className="mt-2 flex gap-2">
                        <input
                          className="input"
                          placeholder="Write a reply"
                          value={replyByComment[comment.id] || ""}
                          onChange={(event) =>
                            setReplyByComment((prev) => ({ ...prev, [comment.id]: event.target.value }))
                          }
                        />
                        <button
                          type="button"
                          className="rounded-lg border border-line px-3 py-2 text-sm"
                          onClick={() => void addReply(post.id, comment.id)}
                        >
                          Reply
                        </button>
                      </div>
                    ) : null}

                    {replies.length > 0 ? (
                      <div className="comment-thread mt-3 space-y-2">
                        {replies.map((reply) => {
                          const canEditReply = meId === reply.author.id;
                          const editingReplyValue = editingComment[reply.id];
                          return (
                            <div key={reply.id} className="ml-2 rounded-lg border border-line bg-bg p-3">
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-sm text-slate-300">
                                  <span className="font-medium text-slate-100">@{reply.author.username}</span>{" "}
                                  {new Date(reply.createdAt).toLocaleString()}
                                </p>
                                {canEditReply ? (
                                  <div className="flex gap-1 text-xs">
                                    <button
                                      type="button"
                                      className="rounded-md border border-line px-2 py-1"
                                      onClick={() =>
                                        setEditingComment((prev) => ({ ...prev, [reply.id]: reply.body }))
                                      }
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-danger rounded-md px-2 py-1"
                                      onClick={() => void deleteComment(reply.id, post.id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                              {editingReplyValue !== undefined ? (
                                <div className="mt-2 space-y-2">
                                  <textarea
                                    className="input min-h-20"
                                    value={editingReplyValue}
                                    onChange={(event) =>
                                      setEditingComment((prev) => ({
                                        ...prev,
                                        [reply.id]: event.target.value,
                                      }))
                                    }
                                  />
                                  <div className="flex gap-2 text-xs">
                                    <button
                                      type="button"
                                      className="rounded-md border border-line px-2 py-1"
                                      onClick={() => void saveCommentEdit(reply.id, post.id, comment.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-md border border-line px-2 py-1"
                                      onClick={() =>
                                        setEditingComment((prev) => {
                                          const next = { ...prev };
                                          delete next[reply.id];
                                          return next;
                                        })
                                      }
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-1 text-sm text-slate-300">{reply.body}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Add a comment"
                  value={newCommentByPost[post.id] || ""}
                  onChange={(event) => setNewCommentByPost((prev) => ({ ...prev, [post.id]: event.target.value }))}
                />
                <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void addComment(post.id)}>
                  Comment
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </Shell>
  );
}

function createPreview(content: string) {
  const maxChars = 250;
  const lines = content.split("\n");
  const byLines = lines.slice(0, 10).join("\n");
  const byChars = content.slice(0, maxChars);
  const truncatedByChars = content.length > maxChars;
  const truncatedByLines = lines.length > 10;

  if (truncatedByChars && truncatedByLines) {
    const text = byLines.length < byChars.length ? byLines : `${byChars}...`;
    return { text, truncated: true };
  }

  if (truncatedByLines) return { text: `${byLines}...`, truncated: true };
  if (truncatedByChars) return { text: `${byChars}...`, truncated: true };
  return { text: content, truncated: false };
}

function parseReplyBody(body: string) {
  const match = body.match(/^@reply:([a-zA-Z0-9_-]+)\n([\s\S]*)$/);
  if (!match) return { parentId: null as string | null, text: body };
  return { parentId: match[1], text: match[2] };
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
