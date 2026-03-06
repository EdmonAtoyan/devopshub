"use client";

import { apiRequest } from "@/lib/api";
import { AnimatedLogo } from "@/components/animated-logo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/feed");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed. Check your credentials.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form className="card w-full space-y-3 p-5" onSubmit={onSubmit}>
        <div className="flex justify-center">
          <AnimatedLogo className="logo-img h-16 w-auto max-w-full" />
        </div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <input className="input" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input className="input" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        <button disabled={loading} className="btn-positive-solid w-full rounded-lg px-4 py-2 text-sm font-semibold">
          {loading ? "Signing in..." : "Continue"}
        </button>
        <div className="pt-1 text-right">
          <Link href="/forgot-password" className="text-xs text-slate-400 hover:text-slate-200">
            Forgot password?
          </Link>
        </div>
      </form>
    </div>
  );
}
