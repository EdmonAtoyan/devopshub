"use client";

import { AutoLinkedText } from "@/components/auto-linked-text";
import { EmojiTextEditor } from "@/components/emoji-text-editor";
import { Shell } from "@/components/shell";
import { UsernameInline } from "@/components/verified-badge";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { FormEvent, useEffect, useState } from "react";

type ArticleComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; verified?: boolean; name: string };
};

type ArticleItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  slug: string;
  author: { id: string; username: string; verified?: boolean; name: string };
  tags: { tag: { name: string } }[];
  comments: ArticleComment[];
  _count: { likes: number; comments: number; bookmarks: number };
};

export default function ArticlesPage() {
  const [items, setItems] = useState<ArticleItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState<CurrentUser>(null);
  const [editingArticle, setEditingArticle] = useState<{ id: string; title: string; body: string } | null>(null);
  const [newCommentByArticle, setNewCommentByArticle] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<Record<string, string>>({});

  const meId = me?.id ?? "";

  const loadMe = async () => {
    try {
      setMe(await getCurrentUser());
    } catch {
      setMe(null);
    }
  };

  const load = async () => {
    try {
      setItems(await apiRequest<ArticleItem[]>("articles?limit=20&commentLimit=3"));
      setError("");
    } catch {
      setError("Could not load articles.");
    }
  };

  useEffect(() => {
    void load();
    void loadMe();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("articles", { method: "POST", body: JSON.stringify({ title, body }) });
      setTitle("");
      setBody("");
      await load();
    } catch {
      setError("Login is required to publish.");
    }
  };

  const saveEdit = async () => {
    if (!editingArticle) return;
    try {
      await apiRequest(`articles/${editingArticle.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editingArticle.title, body: editingArticle.body }),
      });
      setEditingArticle(null);
      await load();
    } catch {
      setError("Could not update article.");
    }
  };

  const removeArticle = async (id: string) => {
    try {
      await apiRequest(`articles/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("You can only delete your own articles.");
    }
  };

  const interact = async (id: string, action: "like" | "bookmark") => {
    try {
      await apiRequest(`articles/${id}/${action}`, { method: "POST" });
      await load();
    } catch {
      setError("Login is required for this action.");
    }
  };

  const addComment = async (articleId: string) => {
    const value = (newCommentByArticle[articleId] || "").trim();
    if (!value) return;

    try {
      await apiRequest(`articles/${articleId}/comments`, { method: "POST", body: JSON.stringify({ body: value }) });
      setNewCommentByArticle((prev) => ({ ...prev, [articleId]: "" }));
      await load();
    } catch {
      setError("Login is required to comment.");
    }
  };

  const saveCommentEdit = async (commentId: string) => {
    const value = (editingComment[commentId] || "").trim();
    if (!value) return;

    try {
      await apiRequest(`articles/comments/${commentId}`, { method: "PATCH", body: JSON.stringify({ body: value }) });
      setEditingComment((prev) => {
        const next = { ...prev };
        delete next[commentId];
        return next;
      });
      await load();
    } catch {
      setError("Could not edit comment.");
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await apiRequest(`articles/comments/${commentId}`, { method: "DELETE" });
      await load();
    } catch {
      setError("Could not delete comment.");
    }
  };

  return (
    <Shell>
      <header className="page-header page-enter">
        <div className="page-header-copy">
          <h1 className="page-title">Long-form technical writing</h1>
          <p className="page-lead">Use articles when a topic deserves structure, context, and a more durable place in the knowledge flow.</p>
        </div>
      </header>

      <section className="page-section page-enter">
        <div className="space-y-4">
          <div>
            <h2 className="section-heading">Publish an article</h2>
            <p className="section-copy mt-1">Lead with a clear title, then use the body for the full explanation, tradeoffs, and implementation detail.</p>
          </div>
          <form className="space-y-4" onSubmit={create}>
            <input className="input" placeholder="Article title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <EmojiTextEditor
              multiline
              className="input min-h-40"
              placeholder="Write in markdown..."
              value={body}
              onValueChange={setBody}
              required
            />
            <div className="form-actions">
              <span className="text-sm text-slate-400">Articles are best for durable knowledge, not quick thread-style updates.</span>
              <button className="btn-primary w-full sm:w-auto">Publish article</button>
            </div>
          </form>
        </div>
        {error ? <p className="mt-4 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {items.map((article) => {
        const isAuthor = meId === article.author.id;
        return (
          <article key={article.id} className="page-section page-enter">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">By @{article.author.username}</p>
              </div>
              {isAuthor ? (
                <div className="flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    className="btn-secondary min-h-0 px-3 py-2 text-xs"
                    onClick={() => setEditingArticle({ id: article.id, title: article.title, body: article.body })}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn-danger min-h-0 px-3 py-2 text-xs" onClick={() => void removeArticle(article.id)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            {editingArticle?.id === article.id ? (
              <div className="mt-4 space-y-3">
                <input
                  className="input"
                  value={editingArticle.title}
                  onChange={(event) => setEditingArticle({ ...editingArticle, title: event.target.value })}
                />
                <EmojiTextEditor
                  multiline
                  className="input min-h-32"
                  value={editingArticle.body}
                  onValueChange={(nextBody) => setEditingArticle((current) => (current ? { ...current, body: nextBody } : current))}
                />
                <div className="action-cluster">
                  <button type="button" className="btn-primary" onClick={() => void saveEdit()}>
                    Save
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => setEditingArticle(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-slate-100">{article.title}</h3>
                <p className="content-wrap mt-4 whitespace-pre-wrap text-base leading-8 text-slate-300">
                  <AutoLinkedText text={article.body} />
                </p>
              </>
            )}

            <div className="mt-4 flex flex-wrap gap-2 text-sm text-accent">
              {article.tags.map((entry) => (
                <span key={entry.tag.name} className="rounded-xl border border-line bg-bg/50 px-3 py-1.5">
                  #{entry.tag.name}
                </span>
              ))}
            </div>
            <div className="mt-4 action-cluster">
              <button className="btn-secondary" onClick={() => void interact(article.id, "like")}>
                Like {article._count.likes}
              </button>
              <button className="btn-secondary" onClick={() => void interact(article.id, "bookmark")}>
                Bookmark {article._count.bookmarks}
              </button>
              <span className="btn-ghost cursor-default justify-start px-0 text-slate-400">Comments {article._count.comments}</span>
            </div>

            <div className="mt-6 space-y-3 border-t border-line pt-5">
              {article.comments.map((comment) => {
                const canEdit = meId === comment.author.id;
                const editingValue = editingComment[comment.id];

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
                            onClick={() => setEditingComment((prev) => ({ ...prev, [comment.id]: comment.body }))}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn-danger min-h-0 px-3 py-2 text-xs"
                            onClick={() => void deleteComment(comment.id)}
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
                        />
                        <div className="action-cluster">
                          <button type="button" className="btn-primary" onClick={() => void saveCommentEdit(comment.id)}>
                            Save
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
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
                      <p className="content-wrap mt-2 text-sm leading-6 text-slate-300">
                        <AutoLinkedText text={comment.body} />
                      </p>
                    )}
                  </div>
                );
              })}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <EmojiTextEditor
                  className="input"
                  placeholder="Add a comment"
                  value={newCommentByArticle[article.id] || ""}
                  onValueChange={(nextBody) => setNewCommentByArticle((prev) => ({ ...prev, [article.id]: nextBody }))}
                  enableMentions
                />
                <button type="button" className="btn-secondary w-full sm:w-auto" onClick={() => void addComment(article.id)}>
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
