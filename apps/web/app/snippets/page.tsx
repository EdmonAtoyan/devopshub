"use client";

import { CheckIcon, CopyIcon, PencilIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from "@/components/icons";
import { Shell } from "@/components/shell";
import { apiRequest } from "@/lib/api";
import { FormEvent, useEffect, useMemo, useState } from "react";

type SnippetItem = {
  id: string;
  title: string;
  description?: string;
  language: string;
  code: string;
  version: number;
  author: { id: string; username: string };
};

type Me = { id: string; username: string } | null;

export default function SnippetsPage() {
  const [items, setItems] = useState<SnippetItem[]>([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("yaml");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState<Me>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; language: string; code: string } | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});

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
      setItems(await apiRequest<SnippetItem[]>("snippets?limit=30"));
      setError("");
    } catch {
      setError("Could not load snippets.");
    }
  };

  useEffect(() => {
    void load();
    void loadMe();
  }, []);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    try {
      await apiRequest("snippets", { method: "POST", body: JSON.stringify({ title, language, code }) });
      setTitle("");
      setCode("");
      await load();
    } catch {
      setError("Login is required to share snippets.");
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await apiRequest(`snippets/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: editing.title, language: editing.language, code: editing.code }),
      });
      setEditing(null);
      await load();
    } catch {
      setError("Could not update snippet.");
    }
  };

  const remove = async (id: string) => {
    const approved = window.confirm("Delete this snippet permanently?");
    if (!approved) return;

    try {
      await apiRequest(`snippets/${id}`, { method: "DELETE" });
      await load();
    } catch {
      setError("You can only delete your own snippets.");
    }
  };

  const copySnippet = async (snippet: SnippetItem) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(snippet.code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = snippet.code;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      setCopiedSnippetId(snippet.id);
      setTimeout(() => {
        setCopiedSnippetId((current) => (current === snippet.id ? null : current));
      }, 2000);
    } catch {
      setError("Could not copy snippet.");
    }
  };

  return (
    <Shell>
      <header className="card p-4 page-enter">
        <h2 className="text-2xl font-semibold">Code Snippets</h2>
        <p className="mt-1 text-base text-slate-400">Reusable DevOps snippets with syntax-focused formatting.</p>
      </header>

      <section className="card p-4 page-enter">
        <form className="space-y-2" onSubmit={create}>
          <input className="input" placeholder="Snippet title" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <input className="input" placeholder="Language (yaml, bash, terraform...)" value={language} onChange={(event) => setLanguage(event.target.value)} required />
          <textarea className="input min-h-32 font-mono" placeholder="Paste your snippet" value={code} onChange={(event) => setCode(event.target.value)} required />
          <button className="btn-positive inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
            <PlusIcon size={16} />
            Share snippet
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {items.map((snippet) => {
        const isAuthor = meId === snippet.author.id;
        const expanded = !!expandedSnippets[snippet.id];
        const preview = createPreview(snippet.code);
        const showToggle = preview.truncated;

        return (
          <article key={snippet.id} className="card p-4 page-enter">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-semibold">{snippet.title}</h3>
                <p className="mt-1 text-sm text-slate-500">by @{snippet.author.username} · v{snippet.version}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-slate-900 px-2 py-1 font-mono text-sm text-accent">{snippet.language}</span>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs"
                  onClick={() => void copySnippet(snippet)}
                >
                  {copiedSnippetId === snippet.id ? (
                    <>
                      Copied
                      <CheckIcon size={12} />
                    </>
                  ) : (
                    <>
                      Copy
                      <CopyIcon size={12} />
                    </>
                  )}
                </button>
                {isAuthor ? (
                  <>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs"
                      onClick={() => setEditing({ id: snippet.id, title: snippet.title, language: snippet.language, code: snippet.code })}
                    >
                      <PencilIcon size={12} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-danger inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs"
                      onClick={() => void remove(snippet.id)}
                    >
                      <TrashIcon size={12} />
                      Delete
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            {editing?.id === snippet.id ? (
              <div className="mt-3 space-y-2">
                <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                <input className="input" value={editing.language} onChange={(event) => setEditing({ ...editing, language: event.target.value })} />
                <textarea className="input min-h-40 font-mono" value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} />
                <div className="flex gap-2 text-sm">
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1" onClick={() => void saveEdit()}>
                    <SaveIcon size={14} />
                    Save
                  </button>
                  <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1" onClick={() => setEditing(null)}>
                    <XIcon size={14} />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3">
                <pre className={`overflow-x-auto rounded-xl border border-line bg-bg p-3 text-sm text-slate-300 transition-all duration-200 ${expanded ? "max-h-[1200px]" : "max-h-72 overflow-hidden"}`}>
                  <code>{expanded ? snippet.code : preview.text}</code>
                </pre>
                {showToggle ? (
                  <button
                    type="button"
                    className="mt-2 inline-flex items-center gap-1 text-sm text-accent"
                    onClick={() => setExpandedSnippets((prev) => ({ ...prev, [snippet.id]: !expanded }))}
                  >
                    {expanded ? "↑ Show less" : "↓ Show more"}
                  </button>
                ) : null}
              </div>
            )}
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
