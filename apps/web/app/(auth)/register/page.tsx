"use client";

import { AnimatedLogo } from "@/components/animated-logo";
import { CaptchaField, captchaEnabled } from "@/components/captcha-field";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { PasswordField } from "@/components/password-field";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, captchaToken }),
      });
      router.push(`/verify-email?email=${encodeURIComponent(email.trim())}&sent=1`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setError(message);
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
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Set up a profile built for infrastructure work.</h1>
              <p className="max-w-xl text-base leading-8 text-slate-400">
                Join the shared space for incident learnings, code snippets, and practical DevOps utilities without mixing long-form content into the wrong surface.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Profile</p>
                <p className="mt-1 text-sm text-slate-400">Show your specialties and activity history.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Contribute</p>
                <p className="mt-1 text-sm text-slate-400">Publish discussions, articles, and snippets.</p>
              </div>
              <div className="stat-card">
                <p className="text-sm font-medium text-slate-100">Discover</p>
                <p className="mt-1 text-sm text-slate-400">Find experts and follow useful streams.</p>
              </div>
            </div>
          </div>
        </section>

        <form className="page-section space-y-5" onSubmit={onSubmit}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Create account</h2>
            <p className="text-sm leading-6 text-slate-400">
              Start with the core details now. You can complete your profile later in settings, but email verification is required before sign-in is enabled.
            </p>
          </div>
          <div className="space-y-3">
            <GoogleAuthButton />
            <div className="flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
              <span className="h-px flex-1 bg-slate-800" />
              <span>Or create an account with email</span>
              <span className="h-px flex-1 bg-slate-800" />
            </div>
          </div>
          <div className="form-grid">
            <label className="field-label">
              Name
              <input className="input mt-2" value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field-label">
              Email
              <input className="input mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <PasswordField
              label="Password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          <CaptchaField onTokenChange={setCaptchaToken} />
          {error ? <p className="text-sm text-danger-soft">{error}</p> : null}
          <div className="form-actions">
            <p className="text-sm text-slate-400">
              Already registered?{" "}
              <Link href="/login" className="font-medium text-accent hover:text-slate-100">
                Sign in
              </Link>
            </p>
            <button disabled={loading || (captchaEnabled && !captchaToken)} className="btn-primary w-full sm:w-auto">
              {loading ? "Creating account..." : "Create account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
