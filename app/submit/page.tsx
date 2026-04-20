"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, hasSupabase } from "@/lib/supabase/client";

export default function SubmitPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentCount, setSentCount] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lines.length === 0 || !email) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const rows = lines.map((line) => ({
      item: line,
      submitted_by: email,
      is_emergency: false,
    }));

    const { error: insertError } = await supabase.from("oos_reports").insert(rows);
    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSentCount(rows.length);
    setText("");
  }

  function startNew() {
    setSentCount(null);
    setTimeout(() => taRef.current?.focus(), 50);
  }

  if (sentCount !== null) {
    return (
      <div className="py-10 text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-[var(--ok-soft)] flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12l5 5L20 6"
              stroke="var(--ok)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">
            Sent to manager.
          </h1>
          <p className="text-[var(--muted)] mt-2">
            {sentCount} {sentCount === 1 ? "item" : "items"} just landed on the
            list.
          </p>
        </div>
        <div className="flex flex-col gap-2 max-w-sm mx-auto">
          <button onClick={startNew} className="btn-primary w-full">
            Submit more
          </button>
          <Link
            href="/"
            className="text-[14px] font-medium text-[var(--muted)] hover:text-[var(--ink)] py-2"
          >
            View list →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="field-label mb-2">New report</div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
          What&apos;s missing or low?
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Type each item on its own line. Keep going — send when you&apos;re
          done.
        </p>
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured yet — saving is disabled.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <textarea
            ref={taRef}
            className="input min-h-[260px] resize-y text-[16px] leading-[1.6]"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Limes\nTito's\nCilantro\nRibeye (running low, maybe 2 days)`}
            autoFocus
          />
          <div className="flex items-center justify-between text-[12px] text-[var(--muted-2)]">
            <span>
              {lines.length === 0
                ? "One item per line"
                : `${lines.length} ${lines.length === 1 ? "item" : "items"} ready to send`}
            </span>
            {email && <span className="truncate">as {email}</span>}
          </div>
        </div>

        {error && (
          <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            type="submit"
            disabled={lines.length === 0 || submitting || !email}
            className="btn-primary w-full"
          >
            {submitting
              ? "Sending…"
              : lines.length === 0
                ? "Type something to send"
                : `Send ${lines.length} ${lines.length === 1 ? "item" : "items"}`}
          </button>
        </div>
      </form>
    </div>
  );
}
