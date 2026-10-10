"use client";

import { useState } from "react";
import Link from "next/link";
import { ChartNoAxesCombined, LoaderCircle } from "lucide-react";

export default function VerifyEmailForm({ token }: { token: string }) {
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function verify() {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not verify this email.");
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
        <div className="auth-copy"><div className="eyebrow">EMAIL VERIFICATION</div><h1>Verify your email</h1><p>Confirm ownership of your address to activate sign-in.</p></div>
        {!token && <div className="auth-error" role="alert">This verification link is missing its token.</div>}
        {error && <div className="auth-error" role="alert">{error}</div>}
        {message && <div className="auth-info" role="status">{message}</div>}
        {!message && <button className="button button-primary auth-submit" type="button" onClick={() => void verify()} disabled={busy || !token}>{busy ? <LoaderCircle size={16} className="spin" /> : null}Verify email</button>}
        <div className="auth-switch"><Link href="/login">Back to sign in</Link></div>
      </section>
    </main>
  );
}
