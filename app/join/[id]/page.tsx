"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type InviteLink = {
  id: string;
  role: "admin" | "staff";
  active: boolean;
  label: string | null;
};

export default function JoinPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [link, setLink] = useState<InviteLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("invite_links")
      .select("id,role,active,label")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoading(false);
        if (error) setError(error.message);
        else setLink((data as InviteLink) ?? null);
      });
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!link) return;
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const { error: redeemError } = await supabase.rpc("redeem_invite", {
      link_id: link.id,
      user_email: cleaned,
    });
    if (redeemError) {
      setBusy(false);
      setError(redeemError.message);
      return;
    }

    const origin = window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleaned,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    setBusy(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    setSent(true);
  }

  if (loading) {
    return (
      <div className="max-w-sm mx-auto pt-12 text-center text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!link || !link.active) {
    return (
      <div className="max-w-sm mx-auto pt-12 space-y-4 text-center">
        <div className="text-[26px] font-semibold tracking-tight">
          This link isn&apos;t active.
        </div>
        <p className="text-[var(--muted)]">
          Ask an admin for a fresh invite link.
        </p>
        <Link href="/login" className="btn-ghost inline-flex">
          Go to sign in
        </Link>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto pt-12 space-y-4 text-center">
        <div className="mx-auto h-12 w-12 rounded-full bg-[var(--ok-soft)] flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12l5 5L20 6"
              stroke="var(--ok)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="text-[22px] font-semibold tracking-tight">
          Check your email.
        </div>
        <p className="text-[var(--muted)] text-[14px]">
          We sent a sign-in link to <b>{email.trim().toLowerCase()}</b>. Open
          it on this device to finish setting up.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto pt-12 space-y-8">
      <div className="text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center text-lg font-semibold">
          B
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">
          Join Bob&apos;s OOS
        </h1>
        <p className="text-[var(--muted)] text-[15px]">
          {link.label ? (
            <>
              You&apos;ve been invited to <b>{link.label}</b>. Enter your email
              and we&apos;ll send you a magic link.
            </>
          ) : (
            "Enter your email and we'll send you a magic link. No password."
          )}
        </p>
      </div>
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
          disabled={busy || !email.trim()}
          className="btn-primary w-full"
        >
          {busy ? "Sending…" : "Send my link"}
        </button>
      </form>
    </div>
  );
}
