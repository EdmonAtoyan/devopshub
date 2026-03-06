import { Shell } from "@/components/shell";

export default function GuidelinesPage() {
  return (
    <Shell>
      <article className="card space-y-4 p-6 text-base leading-7 text-slate-200">
        <h1 className="text-3xl font-semibold text-slate-100">Community Guidelines</h1>
        <p>Keep discussions technical, respectful, and evidence-based.</p>
        <h2 className="text-xl font-semibold text-slate-100">Be Constructive</h2>
        <p>Share fixes, root causes, and actionable context instead of hostility.</p>
        <h2 className="text-xl font-semibold text-slate-100">No Sensitive Secrets</h2>
        <p>Never publish credentials, private keys, tokens, or customer-sensitive information.</p>
        <h2 className="text-xl font-semibold text-slate-100">Moderation</h2>
        <p>Unsafe or abusive content may be removed and accounts may be restricted.</p>
      </article>
    </Shell>
  );
}
