"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { supabase, hasSupabase, type Category } from "@/lib/supabase";

const CATEGORIES: { value: Category; label: string; emoji: string }[] = [
  { value: "food", label: "Food", emoji: "🍔" },
  { value: "drink", label: "Drink", emoji: "🥤" },
  { value: "alcohol", label: "Bar", emoji: "🍸" },
];

type UrgencyKey = "out" | "emergency" | "1" | "2" | "3" | "7";

const URGENT_OPTIONS: {
  key: UrgencyKey;
  label: string;
  sub: string;
  days: number;
  emergency: boolean;
}[] = [
  { key: "out", label: "Out", sub: "now", days: 0, emergency: false },
  {
    key: "emergency",
    label: "Emergency",
    sub: "urgent",
    days: 0,
    emergency: true,
  },
];

const DAY_OPTIONS: {
  key: UrgencyKey;
  label: string;
  sub: string;
  days: number;
}[] = [
  { key: "1", label: "1", sub: "day", days: 1 },
  { key: "2", label: "2", sub: "days", days: 2 },
  { key: "3", label: "3", sub: "days", days: 3 },
  { key: "7", label: "7+", sub: "days", days: 7 },
];

const NAME_KEY = "bob-oos.submitter";

type Draft = {
  localId: string;
  item: string;
  category: Category;
  days_left: number;
  is_emergency: boolean;
  note: string | null;
};

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [urgency, setUrgency] = useState<UrgencyKey | null>(null);
  const [note, setNote] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  const canAdd = Boolean(item.trim() && category && urgency);

  function addToSession(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
    setError(null);
    const resolved = resolveUrgency(urgency!);
    const draft: Draft = {
      localId:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Date.now() + Math.random()),
      item: item.trim(),
      category: category!,
      days_left: resolved.days,
      is_emergency: resolved.emergency,
      note: note.trim() || null,
    };
    setDrafts((prev) => [draft, ...prev]);
    setItem("");
    setUrgency(null);
    setNote("");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1200);
    itemInputRef.current?.focus();
  }

  function removeDraft(localId: string) {
    setDrafts((prev) => prev.filter((d) => d.localId !== localId));
  }

  async function submitSession() {
    if (!name.trim()) {
      setError("Add your name before submitting.");
      return;
    }
    if (drafts.length === 0) return;
    setError(null);

    if (!supabase) {
      setError(
        "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local."
      );
      return;
    }

    setSubmitting(true);
    localStorage.setItem(NAME_KEY, name.trim());

    const submitter = name.trim();
    const rows = drafts.map((d) => ({
      item: d.item,
      category: d.category,
      days_left: d.days_left,
      is_emergency: d.is_emergency,
      note: d.note,
      submitted_by: submitter,
    }));

    const { error: insertError } = await supabase
      .from("oos_reports")
      .insert(rows);

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmittedCount(drafts.length);
    setDrafts([]);
  }

  function startNewSession() {
    setSubmittedCount(null);
    setItem("");
    setCategory(null);
    setUrgency(null);
    setNote("");
    setError(null);
  }

  if (submittedCount !== null) {
    return <SuccessScreen count={submittedCount} onNew={startNewSession} />;
  }

  return (
    <div className="space-y-7">
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="field-label">New session</div>
          {drafts.length > 0 && (
            <span
              className="pill"
              style={{
                borderColor: "var(--border-strong)",
                background: "var(--surface)",
              }}
            >
              <span
                className="dot"
                style={{ background: "var(--ink)", marginRight: 6 }}
              />
              {drafts.length} queued
            </span>
          )}
        </div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight mt-2">
          {drafts.length === 0
            ? "What's running low tonight?"
            : "Add the next one."}
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Queue everything up, review it, then send the whole list to the
          manager.
        </p>
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured yet — submitting is disabled.
        </div>
      )}

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

      {drafts.length > 0 && (
        <DraftList items={drafts} onRemove={removeDraft} />
      )}

      <form onSubmit={addToSession} className="space-y-6">
        <div className="field-label flex items-center gap-2">
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--bg)] text-[11px]">
            {drafts.length + 1}
          </span>
          {drafts.length === 0 ? "First item" : "Next item"}
        </div>

        <Field label="Category (stays selected — keep adding under it)">
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

        <Field label="What's running out?">
          <input
            ref={itemInputRef}
            className="input"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder={
              category === "food"
                ? "e.g. Ribeye, Limes, Cilantro..."
                : category === "drink"
                  ? "e.g. Fever-Tree tonic, Coke, Sparkling water..."
                  : category === "alcohol"
                    ? "e.g. Tito's, Hendrick's, Pinot Noir..."
                    : "Limes, Tito's, ribeye..."
            }
            autoComplete="off"
            enterKeyHint="next"
          />
        </Field>

        <Field label="How long will it last?">
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              {URGENT_OPTIONS.map((o) => (
                <UrgencyChip
                  key={o.key}
                  option={o}
                  selected={urgency === o.key}
                  onSelect={() => setUrgency(o.key)}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {DAY_OPTIONS.map((d) => (
                <button
                  type="button"
                  key={d.key}
                  onClick={() => setUrgency(d.key)}
                  data-on={urgency === d.key}
                  className="chip flex-col !min-h-[68px] gap-0.5"
                >
                  <span className="num-mono text-lg font-semibold leading-none">
                    {d.label}
                  </span>
                  <span
                    className="text-[11px] font-medium uppercase tracking-wider"
                    style={{
                      color: urgency === d.key ? "inherit" : "var(--muted-2)",
                      opacity: urgency === d.key ? 0.7 : 1,
                    }}
                  >
                    {d.sub}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Field>

        <Field label="How many left (optional)">
          <textarea
            className="input min-h-[84px] resize-none"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. 2 bottles, half a case, one crate..."
          />
        </Field>

        <button
          type="submit"
          disabled={!canAdd}
          className="w-full h-12 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] text-[var(--ink-soft)] font-medium text-[15px] hover:bg-[var(--bg-elev)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {justAdded ? (
            <>
              <Check /> Added to session
            </>
          ) : (
            <>
              <Plus /> Add to session
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 -mx-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
        <button
          type="button"
          onClick={submitSession}
          disabled={drafts.length === 0 || submitting || !name.trim()}
          className="btn-primary w-full"
        >
          {submitting ? (
            <>
              <Spinner /> Sending…
            </>
          ) : drafts.length === 0 ? (
            "Add items to submit"
          ) : (
            `Send ${drafts.length} ${drafts.length === 1 ? "item" : "items"} to manager`
          )}
        </button>
      </div>
    </div>
  );
}

function resolveUrgency(key: UrgencyKey): { days: number; emergency: boolean } {
  const urgent = URGENT_OPTIONS.find((o) => o.key === key);
  if (urgent) return { days: urgent.days, emergency: urgent.emergency };
  const day = DAY_OPTIONS.find((o) => o.key === key)!;
  return { days: day.days, emergency: false };
}

function UrgencyChip({
  option,
  selected,
  onSelect,
}: {
  option: (typeof URGENT_OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  const isEmergency = option.key === "emergency";
  const selectedBg = isEmergency ? "var(--danger)" : "var(--ink)";
  const selectedFg = isEmergency ? "var(--danger-ink)" : "var(--bg)";
  const selectedBorder = isEmergency ? "var(--danger)" : "var(--ink)";
  const restingBorder = isEmergency ? "var(--danger-border)" : "var(--border)";
  const restingBg = isEmergency ? "var(--danger-soft)" : "var(--surface)";
  const restingFg = isEmergency ? "var(--danger)" : "var(--ink)";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="chip flex-col !min-h-[72px] gap-0.5"
      style={{
        background: selected ? selectedBg : restingBg,
        borderColor: selected ? selectedBorder : restingBorder,
        color: selected ? selectedFg : restingFg,
      }}
    >
      <span className="text-[15px] font-semibold leading-none">
        {option.label}
      </span>
      <span
        className="text-[11px] font-medium uppercase tracking-wider"
        style={{ opacity: 0.7 }}
      >
        {option.sub}
      </span>
    </button>
  );
}

function DraftList({
  items,
  onRemove,
}: {
  items: Draft[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="field-label">Review — {items.length} queued</div>
      <ul className="space-y-2">
        {items.map((d) => (
          <li
            key={d.localId}
            className={`card flex items-start gap-3 px-3 py-2.5 ${
              d.is_emergency ? "card-danger" : ""
            }`}
          >
            <span
              className="flex-shrink-0 h-9 w-9 rounded-[10px] flex items-center justify-center text-lg bg-[var(--bg-elev)]"
              aria-hidden
            >
              {CATEGORIES.find((c) => c.value === d.category)?.emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[15px] tracking-tight truncate">
                  {d.item}
                </span>
                {d.is_emergency && (
                  <span className="pill pill-danger">Emergency</span>
                )}
              </div>
              <div className="text-[13px] text-[var(--muted)] mt-0.5 flex flex-wrap gap-x-2">
                <span className="num-mono">
                  {d.days_left === 0 ? "Out now" : `${d.days_left}d left`}
                </span>
                <span className="text-[var(--muted-2)]">·</span>
                <span>
                  {CATEGORIES.find((c) => c.value === d.category)?.label}
                </span>
                {d.note && (
                  <>
                    <span className="text-[var(--muted-2)]">·</span>
                    <span className="italic truncate max-w-[200px]">
                      {d.note}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onRemove(d.localId)}
              aria-label={`Remove ${d.item}`}
              className="flex-shrink-0 h-8 w-8 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-elev)] flex items-center justify-center transition-colors"
            >
              <X />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SuccessScreen({
  count,
  onNew,
}: {
  count: number;
  onNew: () => void;
}) {
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
          {count} {count === 1 ? "item" : "items"} just landed on the list.
        </p>
      </div>
      <div className="flex flex-col gap-2 max-w-sm mx-auto">
        <button onClick={onNew} className="btn-primary w-full">
          Start another session
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

function Plus() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function X() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 6l12 12M18 6L6 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ color: "var(--ok)" }}
    >
      <path
        d="M4 12l5 5L20 6"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
