import Link from "next/link";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default function AccessibilityPage() {
  return (
    <Shell>
      <article className="card space-y-6 p-6 page-enter text-base leading-8 text-slate-200">
        <header className="space-y-3 border-b border-line pb-4">
          <h1 className="text-3xl font-semibold text-slate-100">Accessibility</h1>
          <p className="max-w-3xl text-sm leading-7 text-slate-400">
            DevOps Hub is committed to providing an inclusive and accessible experience for all users, including people with
            disabilities.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Accessibility commitment</h2>
          <p>
            We design and maintain DevOps Hub with usability in mind so that people can read, navigate, and contribute across
            the platform with fewer barriers. Accessibility is treated as part of product quality, not as a separate feature.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Supported features</h2>
          <p>We currently support a number of accessibility-focused patterns across the platform, including:</p>
          <ul className="list-disc space-y-2 pl-5 marker:text-teal-300">
            <li>Keyboard navigation for core workflows and interactive controls.</li>
            <li>Readable contrast in dark mode to improve legibility.</li>
            <li>Semantic HTML that gives structure to pages and content.</li>
            <li>Screen reader compatibility for key navigation and reading flows.</li>
            <li>Scalable text that responds better to browser zoom and user preferences.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Continuous improvement</h2>
          <p>
            Accessibility improvements are ongoing. We continue reviewing components, content structure, and interaction patterns
            so the experience keeps getting better as DevOps Hub evolves.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">Contact</h2>
          <p>
            If you encounter accessibility barriers while using DevOps Hub, please contact us so we can improve the experience.
          </p>
          <p>
            Email{" "}
            <Link
              href="mailto:accessibility@devopshub.com"
              className="text-teal-300 transition hover:text-teal-200 hover:underline"
            >
              accessibility@devopshub.com
            </Link>{" "}
            with the page or feature involved and a short description of the issue.
          </p>
        </section>
      </article>
    </Shell>
  );
}
