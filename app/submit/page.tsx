"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase, hasSupabase, type Category } from "@/lib/supabase";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "food", label: "Food", emoji: "🍔" },
  { value: "drink", label: "Drink", emoji: "🥤" },
  { value: "alcohol", label: "Bar", emoji: "🍸" },
];

const DAY_OPTIONS = [
  { value: 0, label: "Out", sub: "now" },
  { value: 1, label: "1", sub: "day" },
  { value: 2, label: "2", sub: "days" },
  { value: 3, label: "3", sub: "days" },
  { value: 7, label: "7+", sub: "days" },
];

const NAME_KEY = "bob-oos.submitter";

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [emergency, setEmergency] = useState(false);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  const canSubmit = Boolean(
    name.trim() && item.trim() && category && daysLeft !== null && !submitting
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    localStorage.setItem(NAME_KEY, name.trim());

    if (!supabase) {
      setError(
        "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
      );
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("oos_reports").insert({
      item: item.trim(),
      category,
      days_left: daysLeft,
      is_emergency: emergency || daysLeft === 0,
      note: note.trim() || null,
      submitted_by: name.trim(),
    });

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSent(true);
    setItem("");
    setCategory(null);
    setDaysLeft(null);
    setEmergency(false);
    setNote("");
    setTimeout(() => setSent(false), 2600);
  }

  return (
    <div className="space-y-7">
      <header>
        <div className="field-label mb-2">New report</div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
          Flag something running low.
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Ten seconds. The manager sees it instantly.
        </p>
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured yet — saving is disabled.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Your name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex"
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>

        <Field label="What's running out?">
          <input
            className="input"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="Limes, Tito's, ribeye..."
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>

        <Field label="Category">
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                type="button"
                key={c.value}
                onClick={() => setCategory(c.value)}
                data-on={category === c.value}
                className="chip flex-col !min-h-[72px] gap-1"
              >
                <span className="text-2xl leading-none">{c.emoji}</span>
                <span className="text-[13px] font-medium">{c.label}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="How long will it last?">
          <div className="grid grid-cols-5 gap-2">
            {DAY_OPTIONS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => setDaysLeft(d.value)}
                data-on={daysLeft === d.value}
                className="chip flex-col !min-h-[68px] gap-0.5"
              >
                <span className="num-mono text-lg font-semibold leading-none">
                  {d.label}
                </span>
                <span
                  className="text-[11px] font-medium uppercase tracking-wider"
                  style={{
                    color: daysLeft === d.value ? "inherit" : "var(--muted-2)",
                    opacity: daysLeft === d.value ? 0.7 : 1,
                  }}
                >
                  {d.sub}
                </span>
              </button>
            ))}
          </div>
        </Field>

        <label
          className={`flex items-center gap-3 p-4 rounded-[var(--radius)] border cursor-pointer select-none transition-colors ${
            emergency
              ? "border-[var(--danger)] bg-[var(--danger-soft)]"
              : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
          }`}
        >
          <input
            type="checkbox"
            checked={emergency}
            onChange={(e) => setEmergency(e.target.checked)}
            className="sr-only"
          />
          <span
            className={`h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors ${
              emergency
                ? "bg-[var(--danger)] border-[var(--danger)]"
                : "border-[var(--border-strong)]"
            }`}
          >
            {emergency && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                aria-hidden
              >
                <path
                  d="M3 7.5L5.5 10L11 4"
                  stroke="white"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <div className="flex-1">
            <div
              className={`font-medium ${emergency ? "text-[var(--danger)]" : ""}`}
            >
              Emergency
            </div>
            <div className="text-[13px] text-[var(--muted)]">
              Skip the queue — ping the manager now.
            </div>
          </div>
        </label>

        <Field label="Note (optional)">
          <textarea
            className="input min-h-[84px] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Brand, size, supplier, whatever helps..."
          />
        </Field>

        {error && (
          <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <Spinner /> Sending…
              </>
            ) : sent ? (
              "Sent ✓"
            ) : (
              "Send to manager"
            )}
          </button>
        </div>
      </form>

      {sent && (
        <div
          role="status"
          className="toast fixed left-1/2 -translate-x-1/2 bottom-[max(100px,calc(env(safe-area-inset-bottom)+88px))] z-40 rounded-full bg-[var(--ink)] text-[var(--bg)] px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-2"
        >
          <span className="dot" style={{ background: "var(--ok)" }} />
          Logged.{" "}
          <Link href="/" className="underline underline-offset-2">
            View list
          </Link>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="field-label">{label}</div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="animate-spin"
      aria-hidden
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="currentColor"
        strokeWidth="3"
        opacity="0.25"
      />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
