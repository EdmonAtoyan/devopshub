"use client";

import { apiRequest } from "@/lib/api";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("auth/register", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      router.push("/feed");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form className="card w-full space-y-3 p-5" onSubmit={onSubmit}>
        <h1 className="text-lg font-semibold">Create account</h1>
        <input className="input" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} required />
        <input className="input" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <input className="input" placeholder="Password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        <button disabled={loading} className="btn-positive-solid w-full rounded-lg px-4 py-2 text-sm font-semibold">
          {loading ? "Creating account..." : "Register"}
        </button>
      </form>
    </div>
  );
}
