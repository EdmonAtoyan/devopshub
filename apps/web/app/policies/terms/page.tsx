import { Shell } from "@/components/shell";

export default function TermsPage() {
  return (
    <Shell>
      <article className="card space-y-6 p-6 page-enter text-base leading-8 text-slate-200">
        <header className="space-y-2 border-b border-line pb-4">
          <h1 className="text-3xl font-semibold text-slate-100">Terms of Service</h1>
          <p className="text-sm text-slate-400">Last updated: March 4, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">1. Acceptance and Scope</h2>
          <p>
            These Terms govern your access to and use of DevOps Hub, including community discussions, article publishing,
            code snippets, and tool integrations. By creating an account or using the platform, you agree to these Terms.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">2. Eligibility and Account Security</h2>
          <p>
            You must provide accurate account information and maintain account security. You are responsible for all activity
            associated with your account credentials, including API and session usage.
          </p>
          <p>
            You must promptly notify the platform if you suspect credential compromise, unauthorized access, or abuse.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">3. User Responsibilities</h2>
          <p>
            You are responsible for ensuring that content you publish is lawful, technically safe, and does not expose secrets,
            credentials, private keys, customer data, or security-sensitive information.
          </p>
          <p>
            You must not attempt to disrupt service availability, bypass controls, perform unauthorized scanning, or distribute
            malware, exploit code, or deceptive content.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">4. Acceptable Content and Conduct</h2>
          <p>
            Community participation must be constructive and professional. Harassment, hate speech, doxxing, impersonation,
            coordinated abuse, and misleading security claims are prohibited.
          </p>
          <p>
            We may remove content or restrict accounts when activity violates these Terms, creates legal risk, or threatens user
            safety and platform integrity.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">5. Intellectual Property and License</h2>
          <p>
            You retain ownership of content you create. By posting on DevOps Hub, you grant the platform a non-exclusive,
            worldwide license to host, process, display, and distribute that content solely for operating and improving the
            service.
          </p>
          <p>
            You represent that you have the rights required to publish the content and that your contributions do not infringe
            third-party rights.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">6. Platform Limitations and Availability</h2>
          <p>
            The platform is provided on an "as is" and "as available" basis. We do not guarantee uninterrupted access, absolute
            accuracy of user-generated content, or fitness for a specific operational purpose.
          </p>
          <p>
            You are responsible for validating technical guidance before applying it in production environments.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">7. Suspension, Termination, and Enforcement</h2>
          <p>
            We may suspend or terminate access for policy violations, legal requirements, security incidents, abuse patterns, or
            threats to service stability.
          </p>
          <p>
            Enforcement decisions may include content removal, rate-limiting, temporary suspension, or permanent account closure.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-slate-100">8. Liability and Indemnity</h2>
          <p>
            To the maximum extent permitted by applicable law, DevOps Hub is not liable for indirect, incidental, or
            consequential damages arising from platform use. You agree to indemnify the platform for claims arising from your
            unlawful content or misuse of the service.
          </p>
        </section>
      </article>
    </Shell>
  );
}
