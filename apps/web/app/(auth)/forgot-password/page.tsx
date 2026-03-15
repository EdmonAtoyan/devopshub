"use client";

import { AnimatedLogo } from "@/components/animated-logo";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset request.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-safe-screen mx-auto flex max-w-5xl items-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,28rem)] lg:items-center">
        <section className="page-header">
          <div className="space-y-5">
            <AnimatedLogo className="logo-img h-20 w-auto max-w-full" />
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Regain access without losing your workflow context.</h1>
              <p className="max-w-xl text-base leading-8 text-slate-400">
                Submit the email tied to your account and the reset flow will send you back to a clean sign-in path.
              </p>
            </div>
            <div className="subtle-panel">
              <p className="text-sm font-medium text-slate-100">What happens next</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                If the address exists, you’ll receive a reset link. The response stays generic so account existence is not exposed.
              </p>
            </div>
          </div>
        </section>

        <form className="page-section space-y-5" onSubmit={onSubmit}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Forgot password</h2>
            <p className="text-sm leading-6 text-slate-400">Enter your email to receive a secure reset link that expires in one hour.</p>
          </div>
          <label className="field-label">
            Email
            <input
              className="input mt-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          {sent ? <p className="text-sm text-success-soft">If the email exists, a reset link was sent.</p> : null}
          {error ? <p className="text-sm text-danger-soft">{error}</p> : null}
          <div className="form-actions">
            <Link href="/login" className="text-sm text-slate-400 hover:text-slate-100">
              Back to login
            </Link>
            <button disabled={loading} className="btn-primary w-full sm:w-auto">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
