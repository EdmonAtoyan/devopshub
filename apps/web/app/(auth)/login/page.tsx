"use client";

export const dynamic = "force-dynamic";

import { apiRequest } from "@/lib/api";
import { AnimatedLogo } from "@/components/animated-logo";
import { CaptchaField, captchaEnabled } from "@/components/captcha-field";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { PasswordField } from "@/components/password-field";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

const oauthErrorMessages: Record<string, string> = {
  google: "Google sign-in failed. Please try again.",
  google_cancelled: "Google sign-in was cancelled before it completed.",
  google_config: "Google sign-in is not configured for this deployment yet.",
  google_no_email: "Your Google account did not provide an email address to complete sign-in.",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthError, setOauthError] = useState("");
  const displayError = error || oauthErrorMessages[oauthError] || "";

  useEffect(() => {
    setOauthError(new URLSearchParams(window.location.search).get("oauthError") || "");
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    setVerificationEmail("");

    try {
      await apiRequest("auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, captchaToken }),
      });
      router.push("/feed");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Check your credentials.";
      setError(message);
      if (/verify your email/i.test(message)) {
        setVerificationEmail(email.trim());
      }
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
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Return to the operational workspace.</h1>
              <p className="max-w-xl text-base leading-8 text-slate-400">
                Pick up where you left off with the feed, your saved references, and account notifications all in the same place.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Track</p>
                <p className="mt-1 text-sm text-slate-400">Follow fresh community updates.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Publish</p>
                <p className="mt-1 text-sm text-slate-400">Share lessons, articles, and code snippets.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Respond</p>
                <p className="mt-1 text-sm text-slate-400">Stay on top of replies and notifications.</p>
              </div>
            </div>
          </div>
        </section>

        <form className="page-section space-y-5" onSubmit={onSubmit}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Sign in</h2>
            <p className="text-sm leading-6 text-slate-400">
              Use your email and password to continue into the main workspace. New accounts must verify their email before the first sign-in.
            </p>
          </div>
          <div className="space-y-3">
            <GoogleAuthButton />
            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              <span>Or sign in with email</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Email
              <input className="input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <PasswordField
              label="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <CaptchaField onTokenChange={setCaptchaToken} />
          {displayError ? <p className="text-sm text-danger-soft">{displayError}</p> : null}
          {verificationEmail ? (
            <p className="text-sm text-slate-400">
              Need a fresh verification link?{" "}
              <Link href={`/verify-email?email=${encodeURIComponent(verificationEmail)}`} className="font-medium text-accent hover:text-slate-100">
                Resend it
              </Link>
            </p>
          ) : null}
          <div className="form-actions border-0 pt-0">
            <Link href="/forgot-password" className="text-sm text-slate-400 hover:text-slate-100">
              Forgot password?
            </Link>
            <button disabled={loading || (captchaEnabled && !captchaToken)} className="btn-primary w-full sm:w-auto">
              {loading ? "Signing in..." : "Continue"}
            </button>
          </div>
          <p className="text-sm text-slate-400">
            Need an account?{" "}
            <Link href="/register" className="font-medium text-accent hover:text-slate-100">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
