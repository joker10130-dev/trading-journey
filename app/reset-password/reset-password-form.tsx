"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, LoaderCircle } from "lucide-react";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not reset your password.");
        return;
      }
      setPassword("");
      setMessage(payload.message);
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card panel">
        <div className="brand auth-brand"><div className="brand-mark"><ChartNoAxesCombined size={20} /></div><span>trade<span className="brand-light">journal</span></span></div>
        <div className="auth-copy"><div className="eyebrow">ACCOUNT RECOVERY</div><h1>Choose a new password</h1><p>Use at least 12 characters. The reset link works once and expires after 30 minutes.</p></div>
        {!token && <div className="auth-error" role="alert">This reset link is missing its token.</div>}
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} required disabled={!token || Boolean(message)} /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-info" role="status">{message}</div>}
          {!message && <button className="button button-primary auth-submit" disabled={busy || !token}>{busy ? <LoaderCircle size={16} className="spin" /> : null}Update password</button>}
        </form>
        <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
      </section>
    </main>
  );
}
