"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/orders";

  const [supabase] = useState(() => createBrowserSupabase());
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { shouldCreateUser: true }
    });
    setBusy(false);
    if (error) return setError(error.message);
    setStep("code");
    setNotice(`We sent a 6-digit code to ${email.trim().toLowerCase()}.`);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email"
    });
    setBusy(false);
    if (error) return setError(error.message);
    router.push(next);
    router.refresh();
  }

  async function google() {
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` }
    });
    if (error) setError(error.message);
  }

  return (
    <main className="page" style={{ display: "flex", justifyContent: "center", padding: "56px 20px" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <p className="eyebrow" style={{ color: "var(--color-terracotta)" }}>Account</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: "2rem",
            lineHeight: 1.05,
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: "var(--color-charcoal)",
            margin: "8px 0 6px"
          }}
        >
          Sign in
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: "var(--color-neutral)", margin: "0 0 24px" }}>
          Track your orders and proofs. No password — we email you a code.
        </p>

        <div
          style={{
            background: "#fff",
            border: "1px solid var(--color-cream-dark)",
            borderRadius: 14,
            padding: 22
          }}
        >
          {/* Google */}
          <button type="button" onClick={google} className="btn-secondary" style={googleBtn}>
            <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>

          <div style={dividerWrap}>
            <span style={dividerLine} />
            <span style={dividerText}>or</span>
            <span style={dividerLine} />
          </div>

          {step === "email" ? (
            <form onSubmit={sendCode}>
              <label style={lbl}>Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                style={input}
              />
              <button type="submit" disabled={busy} className="btn-primary" style={primaryBtn}>
                {busy ? "Sending…" : "Email me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verify}>
              {notice && <p style={noticeStyle}>{notice}</p>}
              <label style={lbl}>6-digit code</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                required
                autoFocus
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="••••••"
                style={{ ...input, letterSpacing: "8px", textAlign: "center", fontSize: 20 }}
              />
              <button type="submit" disabled={busy || code.length < 6} className="btn-primary" style={primaryBtn}>
                {busy ? "Verifying…" : "Verify & sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setCode(""); setError(null); setNotice(null); }}
                style={backBtn}
              >
                ← Use a different email
              </button>
            </form>
          )}

          {error && <p style={errStyle}>{error}</p>}
        </div>
      </div>
    </main>
  );
}

const googleBtn: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "12px 16px", fontSize: 14, fontWeight: 600, background: "#fff",
  border: "1px solid var(--color-cream-dark)", borderRadius: 10, color: "var(--color-charcoal)", cursor: "pointer"
};
const dividerWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, margin: "18px 0" };
const dividerLine: React.CSSProperties = { flex: 1, height: 1, background: "var(--color-cream-dark)" };
const dividerText: React.CSSProperties = { fontSize: 10, letterSpacing: "2px", textTransform: "uppercase", color: "var(--color-neutral)" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "var(--color-neutral)", margin: "0 0 7px" };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", fontSize: 15, background: "var(--color-cream)", border: "1px solid var(--color-cream-dark)", borderRadius: 10, color: "var(--color-charcoal)", boxSizing: "border-box", marginBottom: 14 };
const primaryBtn: React.CSSProperties = { width: "100%", padding: "13px 16px", fontSize: 12, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", background: "var(--color-terracotta)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" };
const backBtn: React.CSSProperties = { width: "100%", marginTop: 12, padding: 6, fontSize: 12, color: "var(--color-neutral)", background: "none", border: "none", cursor: "pointer" };
const noticeStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "var(--color-success)", margin: "0 0 14px" };
const errStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "var(--color-danger)", margin: "14px 0 0" };

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page" style={{ padding: 56 }} />}>
      <LoginInner />
    </Suspense>
  );
}
