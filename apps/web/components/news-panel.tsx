"use client";

import { apiRequest } from "@/lib/api";
import { useEffect, useState } from "react";

type NewsItem = {
  title: string;
  description: string;
  source: string;
  link: string;
  publishedAt?: string;
};

export function NewsPanel() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiRequest<NewsItem[]>("news?limit=8");
        setItems(data);
        setError("");
      } catch {
        setError("News unavailable");
      }
    };

    void load();
    const timer = setInterval(() => void load(), 1000 * 60 * 5);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="mt-4 border-t border-line pt-4">
      <h3 className="text-sm font-semibold text-slate-200">DevOps News</h3>
      {error ? <p className="mt-2 text-xs text-slate-400">{error}</p> : null}
      <div className="mt-3 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {items.map((item) => (
          <article key={`${item.link}-${item.publishedAt || ""}`} className="rounded-lg border border-line p-3">
            <a href={item.link} target="_blank" rel="noreferrer" className="text-sm font-medium text-slate-100 hover:text-accent">
              {item.title}
            </a>
            <p className="mt-1 text-xs text-slate-400">{item.description || "No summary available."}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <span>{item.source}</span>
              <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ""}</span>
            </div>
          </article>
        ))}
        {!error && items.length === 0 ? <p className="text-xs text-slate-400">No recent articles found.</p> : null}
      </div>
    </section>
  );
}
