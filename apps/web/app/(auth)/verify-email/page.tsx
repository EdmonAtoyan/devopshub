"use client";

export const dynamic = "force-dynamic";

import { AnimatedLogo } from "@/components/animated-logo";
import { CaptchaField, captchaEnabled } from "@/components/captcha-field";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

export default function VerifyEmailPage() {
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [status, setStatus] = useState<"idle" | "verifying" | "verified">("idle");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const nextToken = params.get("token") || "";
    const nextEmail = params.get("email") || "";
    const wasSent = params.get("sent") === "1";

    setToken(nextToken);
    setEmail(nextEmail);
    setStatus(nextToken ? "verifying" : "idle");
    setMessage(wasSent ? "Check your inbox for a verification link." : "");
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;
    setStatus("verifying");
    setError("");

    apiRequest("auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => {
        if (cancelled) {
          return;
        }
        setStatus("verified");
        setMessage("Email verified. You can sign in now.");
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        setStatus("idle");
        setError(err instanceof Error ? err.message : "Could not verify email.");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), captchaToken }),
      });
      setMessage("If the address is pending verification, a fresh link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend verification email.");
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
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Activate your account before signing in.</h1>
              <p className="max-w-xl text-base leading-8 text-slate-400">
                Verification links keep account creation tied to a reachable mailbox and prevent unverified access to the workspace.
              </p>
            </div>
            <div className="subtle-panel">
              <p className="text-sm font-medium text-slate-100">Verification status</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {token
                  ? status === "verifying"
                    ? "Processing the verification link from your email."
                    : "If the link failed or expired, request a fresh one from the form."
                  : "Open this page from the email link, or request a new verification email below."}
              </p>
            </div>
          </div>
        </section>

        <div className="page-section space-y-5">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Verify email</h2>
            <p className="text-sm leading-6 text-slate-400">Links expire after 24 hours. If yours is stale, request another one below.</p>
          </div>

          {message ? <p className="text-sm text-success-soft">{message}</p> : null}
          {error ? <p className="text-sm text-danger-soft">{error}</p> : null}

          {status === "verified" ? (
            <div className="form-actions border-0 pt-0">
              <span className="text-sm text-slate-400">Your account is ready.</span>
              <Link href="/login" className="btn-primary w-full text-center sm:w-auto">
                Continue to login
              </Link>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={onSubmit}>
              <label className="field-label">
                Email
                <input className="input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </label>
              <CaptchaField onTokenChange={setCaptchaToken} />
              <div className="form-actions">
                <Link href="/login" className="text-sm text-slate-400 hover:text-slate-100">
                  Back to login
                </Link>
                <button disabled={loading || (captchaEnabled && !captchaToken)} className="btn-primary w-full sm:w-auto">
                  {loading ? "Sending..." : "Resend verification email"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
