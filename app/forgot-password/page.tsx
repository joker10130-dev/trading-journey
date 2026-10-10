"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, LoaderCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not request a password reset.");
        return;
      }
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
        <div className="auth-copy"><div className="eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password</h1><p>We&apos;ll email a single-use reset link if a verified account matches.</p></div>
        <form className="auth-form" onSubmit={(event) => void submit(event)}>
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          {message && <div className="auth-info" role="status">{message}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : null}Send reset link</button>
        </form>
        <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
      </section>
    </main>
  );
}
