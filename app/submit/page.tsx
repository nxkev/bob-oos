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

type Submitted = {
  id: string;
  item: string;
  category: Category;
  days_left: number;
  is_emergency: boolean;
};

export default function SubmitPage() {
  const [name, setName] = useState("");
  const [item, setItem] = useState("");
  const [category, setCategory] = useState<Category | null>(null);
  const [urgency, setUrgency] = useState<UrgencyKey | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [sessionItems, setSessionItems] = useState<Submitted[]>([]);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  const canAdd = Boolean(
    name.trim() && item.trim() && category && urgency && !submitting
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!canAdd) return;
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

    const resolved = resolveUrgency(urgency!);
    const payload = {
      item: item.trim(),
      category: category!,
      days_left: resolved.days,
      is_emergency: resolved.emergency,
      note: note.trim() || null,
      submitted_by: name.trim(),
    };

    const { data, error: insertError } = await supabase
      .from("oos_reports")
      .insert(payload)
      .select("id")
      .single();

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSessionItems((prev) => [
      {
        id: data?.id ?? crypto.randomUUID(),
        item: payload.item,
        category: payload.category,
        days_left: payload.days_left,
        is_emergency: payload.is_emergency,
      },
      ...prev,
    ]);

    setItem("");
    setCategory(null);
    setUrgency(null);
    setNote("");
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1400);
    itemInputRef.current?.focus();
  }

  const count = sessionItems.length;

  return (
    <div className="space-y-7">
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="field-label">New report</div>
          {count > 0 && (
            <span
              className="pill"
              style={{
                borderColor: "var(--border-strong)",
                background: "var(--surface)",
              }}
            >
              <span
                className="dot"
                style={{ background: "var(--ok)", marginRight: 6 }}
              />
              {count} sent
            </span>
          )}
        </div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight mt-2">
          {count === 0
            ? "Flag something running low."
            : "What else is running low?"}
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Tap <span className="font-medium text-[var(--ink)]">+ Add</span> to
          queue up the next one. Keep going until you&apos;re done.
        </p>
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured yet — saving is disabled.
        </div>
      )}

      {count > 0 && <SessionList items={sessionItems} />}

      <form onSubmit={handleAdd} className="space-y-6">
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
            ref={itemInputRef}
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

        {error && (
          <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent space-y-2">
          <button
            type="submit"
            disabled={!canAdd}
            className="btn-primary w-full"
          >
            {submitting ? (
              <>
                <Spinner /> Adding…
              </>
            ) : justAdded ? (
              <>
                <Check /> Added — next one
              </>
            ) : (
              <>
                <Plus /> Add {count === 0 ? "" : "another"}
              </>
            )}
          </button>
          {count > 0 && (
            <Link
              href="/"
              className="block w-full text-center text-[14px] font-medium text-[var(--muted)] hover:text-[var(--ink)] py-2"
            >
              Done — view list →
            </Link>
          )}
        </div>
      </form>
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

function SessionList({ items }: { items: Submitted[] }) {
  return (
    <div className="space-y-1.5">
      <div className="field-label">Added this session</div>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-center gap-3 px-3 py-2.5 text-[14px]"
          >
            <span
              className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center bg-[var(--bg-elev)]"
              aria-hidden
            >
              {CATEGORIES.find((c) => c.value === it.category)?.emoji}
            </span>
            <span className="font-medium truncate flex-1">{it.item}</span>
            <span className="num-mono text-[13px] text-[var(--muted)]">
              {it.days_left === 0 ? "out" : `${it.days_left}d`}
            </span>
            {it.is_emergency && <span className="pill pill-danger">E</span>}
            <Check size={14} aria-label="saved" />
          </li>
        ))}
      </ul>
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

function Check({
  size = 16,
  ...rest
}: { size?: number } & React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      style={{ color: "var(--ok)" }}
      {...rest}
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
