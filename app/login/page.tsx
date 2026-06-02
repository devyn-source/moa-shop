"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase-browser";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/orders";

  // Google button shows only once the Supabase Google provider is configured,
  // so customers never hit "provider is not enabled". Flip to "true" after the
  // Google web client id/secret are set in Supabase.
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "true";

  const [supabase] = useState(() => createBrowserSupabase());
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div style={overlay}>
      <div style={{ width: "100%", maxWidth: 392 }}>
        {/* Wordmark */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={wordmark}>MOA</div>
          <div style={wordmarkSub}>Magnum Opus Agency</div>
        </div>

        {/* Card */}
        <div style={card}>
          <div style={{ padding: "30px 32px 26px" }}>
            <h1 style={cardHeading}>
              {step === "email" ? "Continue to MOA Catalog" : "Enter your code"}
            </h1>

            {step === "email" ? (
              <>
                {googleEnabled && (
                  <>
                    <button type="button" onClick={google} style={googleBtn}>
                      <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden style={{ flexShrink: 0 }}>
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
                  </>
                )}

                <form onSubmit={sendCode}>
                  <label style={lbl}>Email address</label>
                  <input
                    type="email"
                    required
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    style={input}
                  />
                  <button type="submit" disabled={busy} style={primaryBtn}>
                    {busy ? "Sending…" : "Continue"}
                    <span aria-hidden style={{ marginLeft: 6 }}>→</span>
                  </button>
                </form>
              </>
            ) : (
              <form onSubmit={verify}>
                <p style={codeHint}>
                  We sent a 6-digit code to<br />
                  <strong style={{ color: "var(--color-charcoal)" }}>{email.trim().toLowerCase()}</strong>
                </p>
                <label style={lbl}>Verification code</label>
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
                  style={{ ...input, letterSpacing: "10px", textAlign: "center", fontSize: 22, fontWeight: 700 }}
                />
                <button type="submit" disabled={busy || code.length < 6} style={primaryBtn}>
                  {busy ? "Verifying…" : "Verify & continue"}
                  <span aria-hidden style={{ marginLeft: 6 }}>→</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("email"); setCode(""); setError(null); }}
                  style={backBtn}
                >
                  ← Use a different email
                </button>
              </form>
            )}

            {error && <p style={errStyle}>{error}</p>}
          </div>

          <div style={cardFooter}>Passwordless · secured sign-in</div>
        </div>

        <div style={belowCard}>MOA Catalog</div>
      </div>
    </div>
  );
}

// Full-bleed dark canvas — sits above the site chrome to mirror the OS sign-in.
const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, zIndex: 9999, background: "var(--color-charcoal)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "40px 20px", overflowY: "auto"
};
const wordmark: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "2.6rem",
  letterSpacing: "2px", color: "var(--color-terracotta)", lineHeight: 1
};
const wordmarkSub: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.6rem",
  letterSpacing: "4px", textTransform: "uppercase", color: "#7C7872", marginTop: 8
};
const card: React.CSSProperties = {
  background: "#fff", borderRadius: 16, overflow: "hidden",
  boxShadow: "0 24px 60px rgba(0,0,0,0.35)", border: "1px solid rgba(0,0,0,0.06)"
};
const cardHeading: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "0.95rem",
  letterSpacing: "0.5px", textTransform: "uppercase", textAlign: "center",
  color: "var(--color-charcoal)", margin: "0 0 22px", lineHeight: 1.3
};
const googleBtn: React.CSSProperties = {
  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
  padding: "12px 16px", fontSize: 14, fontWeight: 500, background: "#fff",
  border: "1px solid var(--color-cream-dark)", borderRadius: 10, color: "var(--color-charcoal)", cursor: "pointer"
};
const dividerWrap: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, margin: "18px 0" };
const dividerLine: React.CSSProperties = { flex: 1, height: 1, background: "var(--color-cream-dark)" };
const dividerText: React.CSSProperties = { fontSize: 12, color: "var(--color-neutral)" };
const lbl: React.CSSProperties = { display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--color-charcoal)", margin: "0 0 7px" };
const input: React.CSSProperties = { width: "100%", padding: "12px 14px", fontSize: 14, background: "#fff", border: "1px solid var(--color-cream-dark)", borderRadius: 10, color: "var(--color-charcoal)", boxSizing: "border-box", marginBottom: 16, outlineColor: "var(--color-terracotta)" };
const primaryBtn: React.CSSProperties = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "13px 16px", fontSize: 12, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", background: "var(--color-terracotta)", color: "#fff", border: "none", borderRadius: 10, cursor: "pointer" };
const backBtn: React.CSSProperties = { width: "100%", marginTop: 14, padding: 4, fontSize: 12, color: "var(--color-neutral)", background: "none", border: "none", cursor: "pointer" };
const codeHint: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "var(--color-neutral)", textAlign: "center", margin: "0 0 20px" };
const cardFooter: React.CSSProperties = { background: "#F6F4F0", borderTop: "1px solid var(--color-cream-dark)", padding: "12px", textAlign: "center", fontSize: 10, letterSpacing: "1.5px", textTransform: "uppercase", color: "var(--color-neutral)" };
const belowCard: React.CSSProperties = { textAlign: "center", marginTop: 22, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "0.6rem", letterSpacing: "3px", textTransform: "uppercase", color: "#5C5954" };
const errStyle: React.CSSProperties = { fontSize: 13, lineHeight: 1.5, color: "var(--color-danger)", margin: "14px 0 0", textAlign: "center" };

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ position: "fixed", inset: 0, background: "#1E1E1E" }} />}>
      <LoginInner />
    </Suspense>
  );
}
