"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient, hasSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
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
          We&apos;ll email you a magic link. One tap and you&apos;re in — no
          passwords.
        </p>
      </div>

      {!hasSupabase ? (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase isn&apos;t configured yet.
        </div>
      ) : sent ? (
        <div className="card p-5 text-center space-y-3">
          <div className="mx-auto h-10 w-10 rounded-full bg-[var(--ok-soft)] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12l5 5L20 6"
                stroke="var(--ok)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="font-semibold">Check your email.</div>
          <div className="text-[13px] text-[var(--muted)]">
            We sent a link to <b>{email.trim().toLowerCase()}</b>. Open it on
            this device to finish signing in.
          </div>
          <button
            onClick={() => {
              setSent(false);
              setEmail("");
            }}
            className="btn-ghost !h-9 mt-2"
          >
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
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
            {sending ? "Sending…" : "Send magic link"}
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
