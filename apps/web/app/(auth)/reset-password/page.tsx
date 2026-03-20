"use client";

export const dynamic = "force-dynamic";

import { AnimatedLogo } from "@/components/animated-logo";
import { apiRequest } from "@/lib/api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const value = new URLSearchParams(window.location.search).get("token") || "";
    setToken(value);
  }, []);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) {
      setError("Reset token is missing.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      await apiRequest("auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      router.push("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
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
              <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">Choose a new password and go straight back to work.</h1>
              <p className="max-w-xl text-base leading-8 text-slate-400">
                This step is intentionally narrow: confirm the new password here, then continue through the normal sign-in flow.
              </p>
            </div>
            <div className="subtle-panel">
              <p className="text-sm font-medium text-slate-100">Reset token status</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                {token ? "Reset token detected. You can complete the password change below." : "Open this page from the reset link in your email so the token is included automatically."}
              </p>
            </div>
          </div>
        </section>

        <form className="page-section space-y-5" onSubmit={onSubmit}>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">Reset password</h2>
            <p className="text-sm leading-6 text-slate-400">Use at least eight characters and keep the confirmation field identical.</p>
          </div>
          <div className="form-grid">
            <label className="field-label">
              New password
              <input
                className="input mt-2"
                type="password"
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label className="field-label">
              Confirm new password
              <input
                className="input mt-2"
                type="password"
                minLength={8}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
              />
            </label>
          </div>
          {error ? <p className="text-sm text-danger-soft">{error}</p> : null}
          <div className="form-actions">
            <Link href="/login" className="text-sm text-slate-400 hover:text-slate-100">
              Back to login
            </Link>
            <button disabled={loading} className="btn-primary w-full sm:w-auto">
              {loading ? "Resetting..." : "Reset password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
