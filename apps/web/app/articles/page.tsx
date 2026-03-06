"use client";

import { Shell } from "@/components/shell";
import { apiRequest } from "@/lib/api";
import { FormEvent, useEffect, useMemo, useState } from "react";

type ArticleComment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; username: string; name: string };
};

type ArticleItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  slug: string;
  author: { id: string; username: string; name: string };
  tags: { tag: { name: string } }[];
  comments: ArticleComment[];
  _count: { likes: number; comments: number; bookmarks: number };
};

type Me = { id: string; username: string } | null;

export default function ArticlesPage() {
  const [items, setItems] = useState<ArticleItem[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me>(null);
  const [editingArticle, setEditingArticle] = useState<{ id: string; title: string; body: string } | null>(null);
  const [newCommentByArticle, setNewCommentByArticle] = useState<Record<string, string>>({});
  const [editingComment, setEditingComment] = useState<Record<string, string>>({});

  const meId = useMemo(() => me?.id ?? "", [me]);

  const loadMe = async () => {
    try {
      const data = await apiRequest<Me>("auth/me");
      setMe(data);
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
      <header className="card p-4 page-enter">
        <h2 className="text-2xl font-semibold">DevOps Articles</h2>
        <p className="mt-1 text-base text-slate-400">Long-form infrastructure and platform engineering posts.</p>
      </header>

      <section className="card p-4 page-enter">
        <form className="space-y-2" onSubmit={create}>
          <input className="input" placeholder="Article title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <textarea className="input min-h-32" placeholder="Write in markdown..." value={body} onChange={(event) => setBody(event.target.value)} required />
          <button className="btn-positive-solid rounded-lg px-4 py-2 text-sm font-semibold">Publish article</button>
        </form>
        {error ? <p className="mt-2 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {items.map((article) => {
        const isAuthor = meId === article.author.id;
        return (
          <article key={article.id} className="card p-4 page-enter">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm text-slate-500">by @{article.author.username}</p>
              </div>
              {isAuthor ? (
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    className="rounded-md border border-line px-2 py-1"
                    onClick={() => setEditingArticle({ id: article.id, title: article.title, body: article.body })}
                  >
                    Edit
                  </button>
                  <button type="button" className="btn-danger rounded-md px-2 py-1" onClick={() => void removeArticle(article.id)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </div>

            {editingArticle?.id === article.id ? (
              <div className="mt-2 space-y-2">
                <input
                  className="input"
                  value={editingArticle.title}
                  onChange={(event) => setEditingArticle({ ...editingArticle, title: event.target.value })}
                />
                <textarea
                  className="input min-h-32"
                  value={editingArticle.body}
                  onChange={(event) => setEditingArticle({ ...editingArticle, body: event.target.value })}
                />
                <div className="flex gap-2 text-sm">
                  <button type="button" className="rounded-lg border border-line px-3 py-1" onClick={() => void saveEdit()}>
                    Save
                  </button>
                  <button type="button" className="rounded-lg border border-line px-3 py-1" onClick={() => setEditingArticle(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="mt-2 text-xl font-semibold">{article.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-base text-slate-300">{article.body}</p>
              </>
            )}

            <div className="mt-2 flex flex-wrap gap-2 text-sm text-accent">
              {article.tags.map((entry) => (
                <span key={entry.tag.name} className="rounded-lg border border-line px-2 py-1">
                  #{entry.tag.name}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <button className="rounded-lg border border-line px-2 py-1" onClick={() => void interact(article.id, "like")}>
                Like {article._count.likes}
              </button>
              <button className="rounded-lg border border-line px-2 py-1" onClick={() => void interact(article.id, "bookmark")}>
                Bookmark {article._count.bookmarks}
              </button>
              <span className="rounded-lg border border-line px-2 py-1 text-slate-400">Comments {article._count.comments}</span>
            </div>

            <div className="mt-4 space-y-2 border-t border-line pt-3">
              {article.comments.map((comment) => {
                const canEdit = meId === comment.author.id;
                const editingValue = editingComment[comment.id];

                return (
                  <div key={comment.id} className="rounded-lg border border-line p-2">
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
                            onClick={() => void deleteComment(comment.id)}
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
                          onChange={(event) => setEditingComment((prev) => ({ ...prev, [comment.id]: event.target.value }))}
                        />
                        <div className="flex gap-2 text-xs">
                          <button type="button" className="rounded-md border border-line px-2 py-1" onClick={() => void saveCommentEdit(comment.id)}>
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
                  </div>
                );
              })}

              <div className="flex gap-2">
                <input
                  className="input"
                  placeholder="Add a comment"
                  value={newCommentByArticle[article.id] || ""}
                  onChange={(event) =>
                    setNewCommentByArticle((prev) => ({
                      ...prev,
                      [article.id]: event.target.value,
                    }))
                  }
                />
                <button type="button" className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => void addComment(article.id)}>
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
