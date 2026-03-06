import { Shell } from "@/components/shell";

export default function PrivacyPage() {
  return (
    <Shell>
      <article className="card space-y-6 p-6 page-enter text-base leading-8 text-slate-200">
        <header className="space-y-2 border-b border-line pb-4">
          <h1 className="text-3xl font-semibold text-slate-100">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Last updated: March 4, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">1. Data We Collect</h2>
          <p>
            We collect account identifiers (such as username and email), profile settings, uploaded avatars, and content you
            create including posts, comments, snippets, and articles.
          </p>
          <p>
            Operational metadata such as request logs, authentication events, and abuse-prevention signals may also be collected
            to keep the platform secure and reliable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">2. How We Use Data</h2>
          <p>
            Data is used to authenticate users, provide community features, personalize relevant content, enforce policy, and
            improve service performance.
          </p>
          <p>
            We do not sell personal data to third parties. Data processing is limited to legitimate platform operation,
            compliance, and security requirements.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">3. Cookies and Session Data</h2>
          <p>
            We use secure session cookies for authentication and account continuity. Optional preference cookies may store UI
            settings such as theme choices.
          </p>
          <p>
            You can clear browser cookies at any time, which may log you out and reset local preferences.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">4. Data Sharing and Processors</h2>
          <p>
            Data may be processed by infrastructure vendors (for hosting, storage, observability, and security operations) under
            contractual confidentiality and data protection obligations.
          </p>
          <p>
            We may disclose data when required by law, court order, or to protect users, systems, and legal rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">5. Data Retention</h2>
          <p>
            Account and content records are retained for as long as needed to operate the platform, comply with legal
            obligations, resolve disputes, and enforce agreements.
          </p>
          <p>
            Deleted content may persist temporarily in backups and logs according to operational retention schedules.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">6. User Rights and Controls</h2>
          <p>
            You may update account details, profile metadata, and selected content through available settings. You may request
            account closure and data export/deletion where legally applicable.
          </p>
          <p>
            We may require identity verification before processing sensitive account or privacy requests.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">7. Security Practices</h2>
          <p>
            We apply technical and organizational controls including authentication safeguards, validation layers, and monitoring.
            No internet service can guarantee absolute security; users should avoid posting secrets and sensitive credentials.
          </p>
        </section>
      </article>
    </Shell>
  );
}
