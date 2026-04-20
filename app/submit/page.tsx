"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient, hasSupabase } from "@/lib/supabase/client";
import type { StatusKind } from "@/lib/supabase";

type Row = {
  id: string;
  item: string;
  status: StatusKind | null;
  qty: string;
};

type Sent = {
  item: string;
  status: StatusKind;
  qty: number | null;
};

const STARTING_ROWS = 6;

function newRow(): Row {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
    item: "",
    status: null,
    qty: "",
  };
}

function initialRows(): Row[] {
  return Array.from({ length: STARTING_ROWS }, newRow);
}

export default function SubmitPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent[] | null>(null);

  useEffect(() => {
    const client = createClient();
    client.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const validRows = rows.filter(
    (r) =>
      r.item.trim().length > 0 &&
      r.status !== null &&
      (r.status !== "low" || r.qty.trim() !== "")
  );

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  }

  function addRow() {
    setRows((prev) => [...prev, newRow()]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (validRows.length === 0 || !email) return;
    setError(null);
    setSubmitting(true);

    const supabase = createClient();
    const payload = validRows.map((r) => {
      const status = r.status!;
      const qty = status === "low" ? Number(r.qty) : null;
      return {
        item: r.item.trim(),
        submitted_by: email,
        status_kind: status,
        qty_left: Number.isFinite(qty) ? qty : null,
        is_emergency: status === "emergency",
      };
    });

    const { error: insertError } = await supabase
      .from("oos_reports")
      .insert(payload);

    setSubmitting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSent(
      validRows.map((r) => ({
        item: r.item.trim(),
        status: r.status!,
        qty: r.status === "low" ? Number(r.qty) : null,
      }))
    );
  }

  function submitMore() {
    setSent(null);
    setRows(initialRows());
    setError(null);
  }

  if (sent) {
    return <ConfirmScreen items={sent} onMore={submitMore} />;
  }

  return (
    <div className="space-y-5">
      <header>
        <div className="field-label mb-2">New report</div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
          What&apos;s out or low?
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Type the item, tap how it&apos;s doing. Add a count when it&apos;s
          running low. Emergency if you need it right now.
        </p>
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured yet — saving is disabled.
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          {rows.map((r, i) => (
            <RowInput
              key={r.id}
              row={r}
              index={i}
              last={i === rows.length - 1}
              onChange={(patch) => updateRow(r.id, patch)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="w-full h-11 rounded-[var(--radius)] border border-dashed border-[var(--border-strong)] text-[var(--muted)] text-[14px] font-medium hover:bg-[var(--bg-elev)] hover:text-[var(--ink)] flex items-center justify-center gap-2"
        >
          <Plus /> Add another row
        </button>

        {error && (
          <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="sticky bottom-0 -mx-4 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent">
          <button
            type="submit"
            disabled={validRows.length === 0 || submitting || !email}
            className="btn-primary w-full"
          >
            {submitting
              ? "Sending…"
              : validRows.length === 0
                ? "Fill in at least one item"
                : `Send ${validRows.length} ${validRows.length === 1 ? "item" : "items"}`}
          </button>
          {email && (
            <div className="text-center text-[11px] text-[var(--muted-2)] pt-2 truncate">
              as {email}
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function RowInput({
  row,
  index,
  last,
  onChange,
}: {
  row: Row;
  index: number;
  last: boolean;
  onChange: (patch: Partial<Row>) => void;
}) {
  const qtyRef = useRef<HTMLInputElement>(null);

  function setStatus(status: StatusKind) {
    if (row.status === status) {
      onChange({ status: null, qty: "" });
      return;
    }
    onChange({ status, qty: status === "low" ? row.qty : "" });
    if (status === "low") {
      setTimeout(() => qtyRef.current?.focus(), 20);
    }
  }

  const isLow = row.status === "low";
  const isOut = row.status === "out";
  const isEr = row.status === "emergency";
  const hasItem = row.item.trim().length > 0;

  return (
    <div className="flex items-stretch gap-1.5">
      <div className="flex-1 min-w-0">
        <input
          className="input !py-2.5 !text-[15px]"
          placeholder={`Item ${index + 1}`}
          value={row.item}
          onChange={(e) => onChange({ item: e.target.value })}
          autoComplete="off"
          enterKeyHint={last ? "done" : "next"}
        />
      </div>
      <StatusButton
        label="Out"
        active={isOut}
        disabled={!hasItem}
        onClick={() => setStatus("out")}
        tone="ink"
      />
      <LowButton
        active={isLow}
        disabled={!hasItem}
        qty={row.qty}
        inputRef={qtyRef}
        onActivate={() => setStatus("low")}
        onQty={(qty) => onChange({ qty })}
      />
      <StatusButton
        label="ER"
        active={isEr}
        disabled={!hasItem}
        onClick={() => setStatus("emergency")}
        tone="danger"
      />
    </div>
  );
}

function StatusButton({
  label,
  active,
  disabled,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: "ink" | "danger";
}) {
  const activeBg = tone === "danger" ? "var(--danger)" : "var(--ink)";
  const activeFg = tone === "danger" ? "var(--danger-ink)" : "var(--bg)";
  const restBorder = tone === "danger" ? "var(--danger-border)" : "var(--border)";
  const restFg = tone === "danger" ? "var(--danger)" : "var(--ink)";
  const restBg = tone === "danger" ? "var(--danger-soft)" : "var(--surface)";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-[52px] rounded-[var(--radius)] border font-semibold text-[13px] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: active ? activeBg : restBg,
        borderColor: active ? activeBg : restBorder,
        color: active ? activeFg : restFg,
      }}
    >
      {label}
    </button>
  );
}

function LowButton({
  active,
  disabled,
  qty,
  inputRef,
  onActivate,
  onQty,
}: {
  active: boolean;
  disabled: boolean;
  qty: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onActivate: () => void;
  onQty: (v: string) => void;
}) {
  if (active) {
    return (
      <div className="flex items-center gap-0 rounded-[var(--radius)] border-2 border-[var(--ink)] bg-[var(--surface)] overflow-hidden">
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={qty}
          onChange={(e) => onQty(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="#"
          className="w-[44px] h-full text-center text-[15px] font-semibold bg-transparent outline-none text-[var(--ink)]"
        />
        <button
          type="button"
          onClick={onActivate}
          aria-label="Clear low"
          className="text-[10px] px-1 h-full text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Low
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onActivate}
      disabled={disabled}
      className="w-[66px] rounded-[var(--radius)] border text-[12.5px] font-semibold leading-tight flex flex-col items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed bg-[var(--surface)] text-[var(--ink)]"
      style={{ borderColor: "var(--border)" }}
    >
      <span className="text-[11px] text-[var(--muted-2)]">#</span>
      <span>Low</span>
    </button>
  );
}

function ConfirmScreen({
  items,
  onMore,
}: {
  items: Sent[];
  onMore: () => void;
}) {
  return (
    <div className="py-8 space-y-6">
      <div className="text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-full bg-[var(--ok-soft)] flex items-center justify-center">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path
              d="M4 12l5 5L20 6"
              stroke="var(--ok)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="text-[24px] font-semibold tracking-tight">
          Sent to manager
        </h1>
        <p className="text-[var(--muted)] text-[14px]">
          Take a quick look — forgot anything? Tap Submit more.
        </p>
      </div>

      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {items.map((it, i) => (
          <li
            key={i}
            className="flex items-center gap-3 px-4 py-3 text-[15px]"
          >
            <span className="flex-1 font-medium truncate">{it.item}</span>
            <span
              className="text-[13px] tabular-nums"
              style={{
                color:
                  it.status === "emergency"
                    ? "var(--danger)"
                    : it.status === "out"
                      ? "var(--ink)"
                      : "var(--muted)",
                fontWeight: it.status === "emergency" ? 700 : 500,
              }}
            >
              {it.status === "out"
                ? "Out"
                : it.status === "emergency"
                  ? "Emergency"
                  : `Low · ${it.qty ?? ""}`}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 12l5 5L20 6"
                stroke="var(--ok)"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </li>
        ))}
      </ul>

      <div className="space-y-2">
        <button onClick={onMore} className="btn-primary w-full">
          Submit more
        </button>
        <Link
          href="/"
          className="block text-center text-[13px] font-medium text-[var(--muted)] hover:text-[var(--ink)] py-2"
        >
          Done →
        </Link>
      </div>
    </div>
  );
}

function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
