import { AnimatedLogo } from "@/components/animated-logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-safe-screen mx-auto flex max-w-[90rem] items-center px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
      <section className="page-header w-full">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.8fr)] lg:items-center">
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-start">
                <AnimatedLogo className="logo-img h-20 w-auto max-w-full sm:h-24" />
              </div>
              <div className="space-y-3">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-100 sm:text-5xl">
                  A clearer workspace for DevOps discussions, patterns, and practical tooling.
                </h1>
                <p className="max-w-2xl text-base leading-8 text-slate-400">
                  Follow the most active conversations, publish deeper technical write-ups, and keep reusable snippets and tools close to the work.
                </p>
              </div>
            </div>

            <div className="action-cluster">
              <Link href="/feed" className="btn-primary">
                Open Feed
              </Link>
              <Link href="/login" className="btn-secondary">
                Sign In
              </Link>
              <Link href="/register" className="btn-ghost">
                Create Account
              </Link>
            </div>

            <div className="stat-grid xl:grid-cols-3">
              <div className="stat-card">
                <p className="text-sm font-semibold text-slate-100">Discuss</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Short-form updates and incident lessons stay front and center in the feed.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-semibold text-slate-100">Document</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Articles and snippets separate long-form knowledge from quick tactical fixes.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-semibold text-slate-100">Execute</p>
                <p className="mt-2 text-sm leading-6 text-slate-300">Built-in tooling keeps frequent formatting and validation tasks one click away.</p>
              </div>
            </div>
          </div>

          <aside className="subtle-panel space-y-5 p-5 sm:p-6">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Start where the work is hottest.</h2>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-line bg-panel/70 p-4">
                <p className="text-sm font-medium text-slate-100">1. Feed</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Track live updates, triage active threads, and react quickly.</p>
              </div>
              <div className="rounded-2xl border border-line bg-panel/70 p-4">
                <p className="text-sm font-medium text-slate-100">2. Articles and Snippets</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Move durable knowledge into dedicated formats so it stays scannable later.</p>
              </div>
              <div className="rounded-2xl border border-line bg-panel/70 p-4">
                <p className="text-sm font-medium text-slate-100">3. Tools</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">Handle support tasks without leaving the same workspace.</p>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
