"use client";

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
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form className="card w-full space-y-3 p-5" onSubmit={onSubmit}>
        <h1 className="text-lg font-semibold">Forgot password</h1>
        <p className="text-sm text-slate-400">Enter your email to receive a reset link.</p>
        <input
          className="input"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        {sent ? (
          <p className="text-xs text-success-soft">If the email exists, a reset link was sent.</p>
        ) : null}
        {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        <button disabled={loading} className="btn-positive-solid w-full rounded-lg px-4 py-2 text-sm font-semibold">
          {loading ? "Sending..." : "Send reset link"}
        </button>
        <Link href="/login" className="block text-center text-xs text-slate-400 hover:text-slate-200">
          Back to login
        </Link>
      </form>
    </div>
  );
}
