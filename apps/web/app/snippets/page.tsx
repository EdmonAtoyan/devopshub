"use client";

import { AutoLinkedText } from "@/components/auto-linked-text";
import { CheckIcon, CopyIcon, PencilIcon, PlusIcon, SaveIcon, TrashIcon, XIcon } from "@/components/icons";
import { SnippetActionButton, SnippetCard, SnippetCodePanel } from "@/components/snippet-card";
import { Shell } from "@/components/shell";
import { apiRequest } from "@/lib/api";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { createTextPreview } from "@/lib/preview";
import { FormEvent, useEffect, useState } from "react";

type SnippetItem = {
  id: string;
  title: string;
  description?: string;
  language: string;
  code: string;
  version: number;
  author: { id: string; username: string; verified?: boolean };
};

export default function SnippetsPage() {
  const [items, setItems] = useState<SnippetItem[]>([]);
  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState("yaml");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [me, setMe] = useState<CurrentUser>(null);
  const [editing, setEditing] = useState<{ id: string; title: string; language: string; code: string } | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [expandedSnippets, setExpandedSnippets] = useState<Record<string, boolean>>({});

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
      <header className="page-header page-enter">
        <div className="page-header-copy">
          <h1 className="page-title">Reusable code and command fragments</h1>
          <p className="page-lead">Keep terse, copy-friendly implementation details here so they stay distinct from longer explanations and discussions.</p>
        </div>
      </header>

      <section className="page-section page-enter">
        <div className="space-y-4">
          <div>
            <h2 className="section-heading">Share a snippet</h2>
            <p className="section-copy mt-1">Use a short title, keep the language explicit, and optimize for fast copy-paste reuse.</p>
          </div>
          <form className="space-y-4" onSubmit={create}>
            <input className="input" placeholder="Snippet title" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <input className="input" placeholder="Language (yaml, bash, terraform...)" value={language} onChange={(event) => setLanguage(event.target.value)} required />
            <textarea className="input min-h-40 font-mono" placeholder="Paste your snippet" value={code} onChange={(event) => setCode(event.target.value)} required />
            <div className="form-actions">
              <span className="text-sm text-slate-400">Keep snippets concise enough to scan, but complete enough to reuse safely.</span>
              <button className="btn-primary w-full sm:w-auto">
                <PlusIcon size={16} />
                Share snippet
              </button>
            </div>
          </form>
        </div>
        {error ? <p className="mt-4 text-sm text-danger-soft">{error}</p> : null}
      </section>

      {items.map((snippet) => {
        const isAuthor = meId === snippet.author.id;
        const expanded = !!expandedSnippets[snippet.id];
        const preview = createTextPreview(snippet.code);
        const showToggle = preview.truncated;

        if (editing?.id === snippet.id) {
          return (
            <article key={snippet.id} className="page-section page-enter">
              <div>
                <h3 className="section-heading">Refine the code without changing its visual hierarchy</h3>
              </div>
              <div className="mt-4 space-y-3">
                <input className="input" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} />
                <input className="input" value={editing.language} onChange={(event) => setEditing({ ...editing, language: event.target.value })} />
                <textarea className="input min-h-48 font-mono" value={editing.code} onChange={(event) => setEditing({ ...editing, code: event.target.value })} />
                <div className="action-cluster">
                  <SnippetActionButton type="button" tone="positive" onClick={() => void saveEdit()}>
                    <SaveIcon size={12} />
                    Save
                  </SnippetActionButton>
                  <SnippetActionButton type="button" onClick={() => setEditing(null)}>
                    <XIcon size={12} />
                    Cancel
                  </SnippetActionButton>
                </div>
              </div>
            </article>
          );
        }

        return (
          <SnippetCard
            key={snippet.id}
            className="page-section page-enter"
            snippet={snippet}
            codeSection={
              <div>
                <SnippetCodePanel className={expanded ? "max-h-none" : "max-h-80 overflow-y-hidden"}>
                  <AutoLinkedText text={expanded ? snippet.code : preview.text} />
                </SnippetCodePanel>
                {showToggle ? (
                  <button
                    type="button"
                    className="snippet-toggle mt-3"
                    onClick={() => setExpandedSnippets((prev) => ({ ...prev, [snippet.id]: !expanded }))}
                  >
                    {expanded ? "↑ Show less" : "↓ Show more"}
                  </button>
                ) : null}
              </div>
            }
            actionBar={
              <>
                <SnippetActionButton
                  type="button"
                  tone={copiedSnippetId === snippet.id ? "positive" : "default"}
                  onClick={() => void copySnippet(snippet)}
                >
                  {copiedSnippetId === snippet.id ? (
                    <>
                      <CheckIcon size={12} />
                      Copied
                    </>
                  ) : (
                    <>
                      <CopyIcon size={12} />
                      Copy
                    </>
                  )}
                </SnippetActionButton>
                {isAuthor ? (
                  <>
                    <SnippetActionButton
                      type="button"
                      onClick={() => setEditing({ id: snippet.id, title: snippet.title, language: snippet.language, code: snippet.code })}
                    >
                      <PencilIcon size={12} />
                      Edit
                    </SnippetActionButton>
                    <SnippetActionButton type="button" tone="danger" onClick={() => void remove(snippet.id)}>
                      <TrashIcon size={12} />
                      Delete
                    </SnippetActionButton>
                  </>
                ) : null}
              </>
            }
          />
        );
      })}
    </Shell>
  );
}
