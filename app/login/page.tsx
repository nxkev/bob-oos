"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient, hasSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const initialError = params.get("error");

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const benignErrors = new Set([
    "Email link is invalid or has expired",
    "PKCE code verifier not found in storage. This can happen if the auth flow was initiated in a different browser or device, or if the storage was cleared. For SSR frameworks (Next.js, SvelteKit, etc.), use @supabase/ssr on both the server and client to store the code verifier in cookies.",
  ]);
  const [error, setError] = useState<string | null>(
    initialError && !benignErrors.has(initialError) ? initialError : null
  );

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) return;
    setError(null);
    setSending(true);

    const supabase = createClient();
    const origin = window.location.origin;
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        shouldCreateUser: true,
      },
    });

    setSending(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    setSent(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    const cleanedEmail = email.trim().toLowerCase();
    const cleanedCode = code.replace(/\D/g, "");
    if (!cleanedEmail || cleanedCode.length < 6 || cleanedCode.length > 10)
      return;
    setError(null);
    setVerifying(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: cleanedEmail,
      token: cleanedCode,
      type: "email",
    });
    setVerifying(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="max-w-sm mx-auto pt-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-lg font-semibold">
          B
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">
          Sign in to Bob&apos;s OOS
        </h1>
        <p className="text-[var(--muted)] text-[15px]">
          {sent
            ? "Enter the code from your email. The code is more reliable than the link on some inboxes (Yahoo, Outlook)."
            : "We'll email you a code. No passwords."}
        </p>
      </div>

      {!hasSupabase ? (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase isn&apos;t configured yet.
        </div>
      ) : sent ? (
        <form onSubmit={handleVerify} className="space-y-4">
          <div className="space-y-2">
            <label className="field-label">Code from email</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              autoFocus
              maxLength={10}
              className="input text-center text-[26px] tracking-[8px] font-semibold num-mono"
              placeholder="••••••"
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
            />
            <div className="text-[12px] text-[var(--muted-2)] text-center">
              Sent to <b>{email.trim().toLowerCase()}</b>
            </div>
          </div>

          {error && (
            <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={verifying || code.length < 6 || code.length > 10}
            className="btn-primary w-full"
          >
            {verifying ? "Verifying…" : "Sign in"}
          </button>

          <div className="flex items-center justify-between text-[13px]">
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
                setError(null);
              }}
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              ← Different email
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={async () => {
                setSending(true);
                setError(null);
                const supabase = createClient();
                const origin = window.location.origin;
                const { error: resendError } =
                  await supabase.auth.signInWithOtp({
                    email: email.trim().toLowerCase(),
                    options: {
                      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
                      shouldCreateUser: true,
                    },
                  });
                setSending(false);
                if (resendError) setError(resendError.message);
              }}
              className="text-[var(--muted)] hover:text-[var(--ink)]"
            >
              {sending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSend} className="space-y-4">
          <div className="space-y-2">
            <label className="field-label">Email</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              autoFocus
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          {error && (
            <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={sending || !email.trim()}
            className="btn-primary w-full"
          >
            {sending ? "Sending…" : "Send 6-digit code"}
          </button>
          <p className="text-center text-[12px] text-[var(--muted-2)] pt-2">
            Only approved emails can sign in. Ask an admin if you&apos;re not on
            the list.
          </p>
        </form>
      )}
    </div>
  );
}
