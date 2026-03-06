"use client";

import { apiRequest } from "@/lib/api";
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
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <form className="card w-full space-y-3 p-5" onSubmit={onSubmit}>
        <h1 className="text-lg font-semibold">Reset password</h1>
        <input
          className="input"
          placeholder="New password"
          type="password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        <input
          className="input"
          placeholder="Confirm new password"
          type="password"
          minLength={8}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
        {error ? <p className="text-xs text-danger-soft">{error}</p> : null}
        <button disabled={loading} className="btn-positive-solid w-full rounded-lg px-4 py-2 text-sm font-semibold">
          {loading ? "Resetting..." : "Reset password"}
        </button>
      </form>
    </div>
  );
}
