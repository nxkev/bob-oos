"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  supabase,
  hasSupabase,
  type Category,
  type OosReport,
  type Status,
} from "@/lib/supabase";

const CATEGORY_LABEL: Record<Category, string> = {
  grocery: "Grocery",
  alcohol: "Alcohol",
};

const CATEGORY_EMOJI: Record<Category, string> = {
  grocery: "🥬",
  alcohol: "🍸",
};

type CategoryFilter = Category | "all";
type StatusFilter = Status | "all";
type SortKey = "urgency" | "alpha";

export default function ManagerListPage() {
  const [reports, setReports] = useState<OosReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [sortKey, setSortKey] = useState<SortKey>("urgency");

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    const client = supabase;
    let cancelled = false;

    async function load() {
      const { data, error: fetchError } = await client
        .from("oos_reports")
        .select("*")
        .order("is_emergency", { ascending: false })
        .order("days_left", { ascending: true })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (fetchError) setError(fetchError.message);
      else setReports((data ?? []) as OosReport[]);
      setLoading(false);
    }

    load();
    const channel = client
      .channel("oos_reports_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oos_reports" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      client.removeChannel(channel);
    };
  }, []);

  const filtered = useMemo(() => {
    const base = reports.filter((r) => {
      if (categoryFilter !== "all" && r.category !== categoryFilter)
        return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      return true;
    });
    if (sortKey === "alpha") {
      return [...base].sort((a, b) =>
        a.item.localeCompare(b.item, undefined, { sensitivity: "base" })
      );
    }
    return [...base].sort((a, b) => {
      if (a.is_emergency !== b.is_emergency) return a.is_emergency ? -1 : 1;
      if (a.days_left !== b.days_left) return a.days_left - b.days_left;
      return b.created_at.localeCompare(a.created_at);
    });
  }, [reports, categoryFilter, statusFilter, sortKey]);

  const openReports = reports.filter((r) => r.status === "open");
  const openCount = openReports.length;
  const emergencyCount = openReports.filter((r) => r.is_emergency).length;

  async function resolve(id: string) {
    if (!supabase) return;
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: "resolved", resolved_at: new Date().toISOString() }
          : r
      )
    );
    const { error: updateError } = await supabase
      .from("oos_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) setError(updateError.message);
  }

  async function reopen(id: string) {
    if (!supabase) return;
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "open", resolved_at: null } : r
      )
    );
    const { error: updateError } = await supabase
      .from("oos_reports")
      .update({ status: "open", resolved_at: null })
      .eq("id", id);
    if (updateError) setError(updateError.message);
  }

  async function clearResolved() {
    if (!supabase) return;
    const resolvedIds = reports
      .filter((r) => r.status === "resolved")
      .map((r) => r.id);
    if (resolvedIds.length === 0) return;
    const ok = window.confirm(
      `Delete ${resolvedIds.length} resolved ${resolvedIds.length === 1 ? "item" : "items"}? This cannot be undone.`
    );
    if (!ok) return;
    setReports((prev) => prev.filter((r) => r.status !== "resolved"));
    const { error: deleteError } = await supabase
      .from("oos_reports")
      .delete()
      .in("id", resolvedIds);
    if (deleteError) setError(deleteError.message);
  }

  const resolvedCount = reports.length - openCount;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="field-label mb-2">Inventory</div>
            <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
              Running low.
            </h1>
          </div>
          <Link
            href="/submit"
            className="btn-ghost !h-9 hidden sm:inline-flex gap-1.5"
          >
            <Plus /> New
          </Link>
        </div>

        <StatRow
          openCount={openCount}
          emergencyCount={emergencyCount}
          resolvedCount={resolvedCount}
        />
      </header>

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured. Copy <code>.env.local.example</code> →{" "}
          <code>.env.local</code>, run <code>supabase/schema.sql</code>, restart
          dev.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="seg">
          {(
            [
              { value: "open", label: "Open" },
              { value: "resolved", label: "Resolved" },
              { value: "all", label: "All" },
            ] as { value: StatusFilter; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              data-on={statusFilter === o.value}
              onClick={() => setStatusFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg">
          {(
            [
              { value: "all", label: "All" },
              { value: "grocery", label: "Grocery" },
              { value: "alcohol", label: "Alcohol" },
            ] as { value: CategoryFilter; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              data-on={categoryFilter === o.value}
              onClick={() => setCategoryFilter(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg ml-auto">
          {(
            [
              { value: "urgency", label: "Days left" },
              { value: "alpha", label: "A–Z" },
            ] as { value: SortKey; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              data-on={sortKey === o.value}
              onClick={() => setSortKey(o.value)}
              aria-label={`Sort by ${o.label}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {resolvedCount > 0 &&
        (statusFilter === "resolved" || statusFilter === "all") && (
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--bg-elev)] px-3 py-2">
            <div className="text-[13px] text-[var(--muted)]">
              {resolvedCount} resolved{" "}
              {resolvedCount === 1 ? "item" : "items"} — items older than 7
              days are flagged.
            </div>
            <button
              onClick={clearResolved}
              className="btn-ghost !h-8 !text-[13px] gap-1.5 text-[var(--danger)] border-[var(--danger-border)] hover:bg-[var(--danger-soft)]"
              aria-label="Delete all resolved items"
            >
              <Trash /> Clear resolved
            </button>
          </div>
        )}

      {error && (
        <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingList />
      ) : filtered.length === 0 ? (
        <EmptyState hasSupabase={hasSupabase} statusFilter={statusFilter} />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              onResolve={resolve}
              onReopen={reopen}
            />
          ))}
        </ul>
      )}

      <Link
        href="/submit"
        className="sm:hidden fixed bottom-[max(20px,env(safe-area-inset-bottom))] right-4 z-30 h-14 w-14 rounded-full bg-[var(--ink)] text-[var(--bg)] flex items-center justify-center shadow-lg"
        aria-label="Submit new"
      >
        <Plus size={22} />
      </Link>
    </div>
  );
}

function StatRow({
  openCount,
  emergencyCount,
  resolvedCount,
}: {
  openCount: number;
  emergencyCount: number;
  resolvedCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat label="Open" value={openCount} />
      <Stat
        label="Emergency"
        value={emergencyCount}
        tone={emergencyCount > 0 ? "danger" : "default"}
      />
      <Stat label="Resolved" value={resolvedCount} tone="muted" />
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "danger" | "muted";
}) {
  const valueColor =
    tone === "danger"
      ? "var(--danger)"
      : tone === "muted"
        ? "var(--muted)"
        : "var(--ink)";
  return (
    <div className="card px-3.5 py-3">
      <div className="field-label !text-[11px]">{label}</div>
      <div
        className="num-mono text-2xl font-semibold leading-tight mt-1"
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </div>
  );
}

function ReportRow({
  report,
  onResolve,
  onReopen,
}: {
  report: OosReport;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
}) {
  const isOpen = report.status === "open";
  const urgent = isOpen && report.is_emergency;
  const soon = isOpen && report.days_left <= 1 && !report.is_emergency;
  const resolvedDays =
    !isOpen && report.resolved_at ? daysSince(report.resolved_at) : null;
  const stale = resolvedDays !== null && resolvedDays >= 7;

  return (
    <li
      className={`card p-4 flex items-start gap-3 ${urgent ? "card-danger" : soon ? "card-warn" : ""} ${isOpen ? "" : stale ? "opacity-70" : "opacity-60"}`}
    >
      <div
        className="flex-shrink-0 h-10 w-10 rounded-[10px] flex items-center justify-center text-xl bg-[var(--bg-elev)]"
        aria-hidden
      >
        {CATEGORY_EMOJI[report.category]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center flex-wrap gap-1.5">
          <span
            className={`font-semibold text-[15px] tracking-tight ${isOpen ? "" : "line-through"}`}
          >
            {report.item}
          </span>
          {urgent && <span className="pill pill-danger">Emergency</span>}
          {stale && (
            <span
              className="pill"
              style={{
                background: "var(--warn-soft)",
                color: "var(--warn)",
                borderColor: "var(--warn-border)",
              }}
            >
              Clear me
            </span>
          )}
        </div>
        <div className="text-[13px] text-[var(--muted)] mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {isOpen ? (
            <>
              <span className="inline-flex items-center gap-1.5">
                <span
                  className="dot"
                  style={{
                    background: urgent
                      ? "var(--danger)"
                      : soon
                        ? "var(--warn)"
                        : "var(--muted-2)",
                  }}
                />
                <span className={urgent || soon ? "font-medium" : ""}>
                  {report.days_left === 0
                    ? "Out now"
                    : `${report.days_left} day${report.days_left === 1 ? "" : "s"} left`}
                </span>
              </span>
              <span className="text-[var(--muted-2)]">·</span>
              <span>{CATEGORY_LABEL[report.category]}</span>
              <span className="text-[var(--muted-2)]">·</span>
              <span>{report.submitted_by}</span>
              <span className="text-[var(--muted-2)]">·</span>
              <span className="num-mono">
                {relativeTime(report.created_at)}
              </span>
            </>
          ) : (
            <>
              <span
                className={`inline-flex items-center gap-1.5 ${stale ? "font-medium text-[var(--warn)]" : ""}`}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden
                >
                  <path
                    d="M4 12l5 5L20 6"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Resolved{" "}
                {resolvedDays === 0
                  ? "today"
                  : resolvedDays === 1
                    ? "yesterday"
                    : `${resolvedDays}d ago`}
              </span>
              <span className="text-[var(--muted-2)]">·</span>
              <span>{CATEGORY_LABEL[report.category]}</span>
              <span className="text-[var(--muted-2)]">·</span>
              <span>{report.submitted_by}</span>
            </>
          )}
        </div>
        {report.note && (
          <div className="text-[13.5px] mt-2 text-[var(--ink-soft)] whitespace-pre-wrap">
            {report.note}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        {isOpen ? (
          <button
            onClick={() => onResolve(report.id)}
            className="btn-ghost"
            aria-label={`Resolve ${report.item}`}
          >
            Resolve
          </button>
        ) : (
          <button
            onClick={() => onReopen(report.id)}
            className="btn-ghost !text-[var(--muted)]"
            aria-label={`Reopen ${report.item}`}
          >
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}

function EmptyState({
  hasSupabase,
  statusFilter,
}: {
  hasSupabase: boolean;
  statusFilter: StatusFilter;
}) {
  const heading = !hasSupabase
    ? "No data yet"
    : statusFilter === "resolved"
      ? "Nothing resolved yet"
      : "Everything's in stock.";
  const sub = hasSupabase
    ? statusFilter === "resolved"
      ? "Resolved items will land here."
      : "Staff reports will appear here the moment they come in."
    : "Finish the Supabase setup to start receiving reports.";
  return (
    <div className="card py-14 px-6 text-center">
      <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center bg-[var(--bg-elev)] mb-4">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 13l4 4L19 7"
            stroke="var(--ok)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="font-semibold text-[15px]">{heading}</div>
      <div className="text-[13px] text-[var(--muted)] mt-1 max-w-xs mx-auto">
        {sub}
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <ul className="space-y-2.5">
      {[0, 1, 2].map((i) => (
        <li key={i} className="card p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-[10px] bg-[var(--bg-elev)] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-[var(--bg-elev)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--bg-elev)] animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Plus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Trash() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M5 7l1 13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-13M9 7V4h6v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((now - then) / 1000);
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}
