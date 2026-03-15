import { Shell } from "@/components/shell";

export default function AboutPage() {
  return (
    <Shell>
      <article className="card space-y-6 p-6 page-enter text-base leading-8 text-slate-200">
        <header className="space-y-3 border-b border-line pb-4">
          <h1 className="text-3xl font-semibold text-slate-100">DevOps Hub</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-400">
            DevOps Hub is a focused space for infrastructure engineers to share practical knowledge, publish reusable artifacts,
            and keep operational lessons close to the work.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">What is DevOps Hub</h2>
          <p>
            DevOps Hub is a community platform built for SREs, platform teams, cloud engineers, and developers who spend real
            time operating systems in production. It separates fast-moving tactical content from deeper documentation so the
            right format is available for the right kind of knowledge.
          </p>
          <p>
            The platform brings together short-form posts, long-form articles, reusable snippets, and lightweight utilities in a
            single workflow instead of scattering them across chat threads, bookmarks, and internal notes.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Mission</h2>
          <p>
            The mission is to make operational knowledge easier to publish, easier to reuse, and easier to trust. That means
            encouraging concrete write-ups, preserving implementation details, and reducing the distance between a problem, its
            context, and a working fix.
          </p>
          <p>
            We want the platform to reward clarity over noise: less vague commentary, more runnable examples, real incident
            learnings, and practical patterns that hold up under production pressure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">What you can do here</h2>
          <p>
            Use the feed to share updates, lessons learned, and short technical discussions. Publish articles for deeper
            explanations, architecture write-ups, or postmortems that need more structure than a post can provide.
          </p>
          <p>
            Save snippets for commands, manifests, and reusable configuration fragments that need to stay copy-friendly. Explore
            built-in tools for quick validation and utility workflows, follow contributors whose work is consistently useful, and
            keep profile activity organized around what you actually ship and operate.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Platform philosophy</h2>
          <p>
            DevOps Hub is designed around a simple idea: operational knowledge should be structured, durable, and easy to scan.
            The product favors explicit metadata, direct language, and interfaces that keep the content itself primary.
          </p>
          <p>
            The philosophy is developer-oriented rather than social-first. Useful artifacts should stand on their own, controls
            should stay out of the way, and the platform should help people move from discovery to implementation with as little
            friction as possible.
          </p>
        </section>
      </article>
    </Shell>
  );
}
