"use client";

import { useState } from "react";
import { ChartNoAxesCombined, LoaderCircle, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, ...(mode === "register" ? { name } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error?.message ?? "Could not authenticate. Please try again.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Could not connect to the server. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card panel">
        <div className="brand auth-brand">
          <div className="brand-mark"><ChartNoAxesCombined size={20} /></div>
          <span>trade<span className="brand-light">journal</span></span>
        </div>
        <div className="auth-copy">
          <div className="eyebrow">YOUR TRADING WORKSPACE</div>
          <h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1>
          <p>{mode === "login" ? "Sign in to review your trading performance." : "Start building a clearer picture of your trading."}</p>
        </div>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label>Name<input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required /></label>
          <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === "register" ? 12 : 1} maxLength={128} required />{mode === "register" && <small>Use at least 12 characters.</small>}</label>
          {error && <div className="auth-error" role="alert">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? <LoaderCircle size={16} className="spin" /> : <LogIn size={16} />}{mode === "login" ? "Sign in" : "Create account"}</button>
        </form>
        <div className="auth-switch">
          {mode === "login" ? "New to Trading Journal?" : "Already have an account?"}
          <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}>
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </div>
      </section>
      <p className="auth-footnote">Your trade history stays yours. We never place trades or make investment decisions for you.</p>
    </main>
  );
}
