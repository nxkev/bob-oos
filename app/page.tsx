"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient, hasSupabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type {
  CatalogItem,
  Category,
  Destination,
  OosReport,
} from "@/lib/supabase";

type Tab = "reports" | "catalog";
type DestFilter = Destination | "all";

export default function ManagerPage() {
  const [tab, setTab] = useState<Tab>("reports");
  const [destFilter, setDestFilter] = useState<DestFilter>("owner");
  const [reports, setReports] = useState<OosReport[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [toast, setToast] = useState<{
    msg: string;
    actionLabel?: string;
    onAction?: () => void;
  } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!cancelled) setUser(u);

      const role = u?.email
        ? await supabase
            .from("allowed_emails")
            .select("role")
            .ilike("email", u.email)
            .maybeSingle()
        : null;
      if (!cancelled) setIsAdmin(role?.data?.role === "admin");

      const [r, c] = await Promise.all([
        supabase
          .from("oos_reports")
          .select("*")
          .order("is_emergency", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("catalog_items")
          .select("*")
          .order("name", { ascending: true }),
      ]);
      if (cancelled) return;
      if (r.error) setError(r.error.message);
      else setReports((r.data ?? []) as OosReport[]);
      if (c.error) setError(c.error.message);
      else setCatalog((c.data ?? []) as CatalogItem[]);
      setLoading(false);
    }

    load();

    const channel = supabase
      .channel("oos_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "oos_reports" },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "catalog_items" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const scopedReports = useMemo(
    () =>
      destFilter === "all"
        ? reports
        : reports.filter((r) => r.destination === destFilter),
    [reports, destFilter]
  );
  const scopedCatalog = useMemo(
    () =>
      destFilter === "all"
        ? catalog
        : catalog.filter((c) => c.destination === destFilter),
    [catalog, destFilter]
  );
  const openReports = scopedReports.filter((r) => r.status === "open");
  const resolvedReports = scopedReports.filter(
    (r) => r.status === "resolved"
  );

  async function resolveReport(id: string) {
    const supabase = createClient();
    setReports((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: "resolved", resolved_at: new Date().toISOString() }
          : r
      )
    );
    const { error } = await supabase
      .from("oos_reports")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) setError(error.message);
  }

  async function reopenReport(id: string) {
    const supabase = createClient();
    setReports((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "open", resolved_at: null } : r
      )
    );
    const { error } = await supabase
      .from("oos_reports")
      .update({ status: "open", resolved_at: null })
      .eq("id", id);
    if (error) setError(error.message);
  }

  async function clearResolved() {
    if (resolvedReports.length === 0) return;
    const ok = window.confirm(
      `Delete ${resolvedReports.length} resolved ${resolvedReports.length === 1 ? "item" : "items"}? This cannot be undone.`
    );
    if (!ok) return;
    const ids = resolvedReports.map((r) => r.id);
    setReports((prev) => prev.filter((r) => r.status !== "resolved"));
    const supabase = createClient();
    const { error } = await supabase.from("oos_reports").delete().in("id", ids);
    if (error) setError(error.message);
  }

  async function addToCatalog(report: OosReport) {
    const supabase = createClient();
    const name = report.item.trim();
    const category: Category =
      report.category === "alcohol" ? "alcohol" : "grocery";
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("catalog_items")
      .upsert(
        {
          name,
          category,
          created_by: user?.email ?? null,
          active: true,
          destination: report.destination,
        },
        { onConflict: "name" }
      )
      .select()
      .maybeSingle();
    if (error) {
      setError(error.message);
      return;
    }
    if (data) {
      // Link the report to the catalog item and resolve it in one pass.
      await supabase
        .from("oos_reports")
        .update({
          catalog_item_id: data.id,
          status: "resolved",
          resolved_at: new Date().toISOString(),
        })
        .eq("id", report.id);
    }
  }

  async function addCatalogItem(
    name: string,
    category: Category,
    destination: Destination,
    supplier: string | null
  ) {
    const cleaned = name.trim();
    if (!cleaned) return;
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("catalog_items").insert({
      name: cleaned,
      category,
      destination,
      supplier: supplier?.trim() || null,
      created_by: user?.email ?? null,
    });
    if (error) setError(error.message);
  }

  async function updateCatalogItem(id: string, patch: Partial<CatalogItem>) {
    const supabase = createClient();
    const before = catalog.find((c) => c.id === id);
    setCatalog((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...patch } : c))
    );
    const { error } = await supabase
      .from("catalog_items")
      .update(patch)
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }

    if (
      before &&
      patch.destination &&
      patch.destination !== before.destination
    ) {
      const movedTo = patch.destination;
      const movedFrom = before.destination;
      setToast({
        msg: `Moved ${before.name} → ${movedTo === "owner" ? "Bob's list" : "Manager's list"}`,
        actionLabel: "Undo",
        onAction: () => updateCatalogItem(id, { destination: movedFrom }),
      });
    }
  }

  async function removeCatalogItem(id: string) {
    const supabase = createClient();
    setCatalog((prev) => prev.filter((c) => c.id !== id));
    const { error } = await supabase
      .from("catalog_items")
      .delete()
      .eq("id", id);
    if (error) setError(error.message);
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="field-label mb-2">Inventory</div>
          <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
            {tab === "reports" ? "What's missing." : "Your item list."}
          </h1>
          <p className="text-[var(--muted)] mt-2 text-[15px]">
            {tab === "reports"
              ? "Staff-flagged items, newest first. Add anything staff flagged to your list."
              : "The master list. Add items here so you can tick them off as you restock."}
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/admin"
            className="btn-ghost !h-9 gap-1.5 flex-shrink-0"
            title="Add or remove users"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Manage team
          </Link>
        )}
      </header>
      {user && (
        <div className="text-[12px] text-[var(--muted-2)]">
          Signed in as {user.email}
        </div>
      )}

      {!hasSupabase && (
        <div className="rounded-[var(--radius)] border border-[var(--warn-border)] bg-[var(--warn-soft)] text-[var(--warn)] px-3 py-2 text-sm">
          Supabase not configured.
        </div>
      )}

      <div className="space-y-2">
        <div className="seg w-full justify-stretch">
          {(
            [
              { value: "owner", label: "Bob's list" },
              { value: "manager", label: "Manager's list" },
              { value: "all", label: "All" },
            ] as { value: DestFilter; label: string }[]
          ).map((o) => (
            <button
              key={o.value}
              data-on={destFilter === o.value}
              onClick={() => setDestFilter(o.value)}
              className="flex-1"
            >
              {o.label}
            </button>
          ))}
        </div>
        <div className="seg w-full justify-stretch">
          <button
            data-on={tab === "reports"}
            onClick={() => setTab("reports")}
            className="flex-1"
          >
            Staff reports ({openReports.length})
          </button>
          <button
            data-on={tab === "catalog"}
            onClick={() => setTab("catalog")}
            className="flex-1"
          >
            Item list ({scopedCatalog.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[max(20px,env(safe-area-inset-bottom))] z-40 rounded-full bg-[var(--ink)] text-[var(--bg)] px-4 py-2.5 text-sm font-medium shadow-lg flex items-center gap-3"
        >
          <span>{toast.msg}</span>
          {toast.actionLabel && toast.onAction && (
            <button
              onClick={() => {
                toast.onAction?.();
                setToast(null);
              }}
              className="underline underline-offset-2 font-semibold"
            >
              {toast.actionLabel}
            </button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingList />
      ) : tab === "reports" ? (
        <ReportsView
          open={openReports}
          resolved={resolvedReports}
          catalog={catalog}
          onResolve={resolveReport}
          onReopen={reopenReport}
          onAddToCatalog={addToCatalog}
          onClearResolved={clearResolved}
        />
      ) : (
        <CatalogView
          catalog={scopedCatalog}
          defaultDestination={destFilter === "all" ? "owner" : destFilter}
          onAdd={addCatalogItem}
          onRemove={removeCatalogItem}
          onUpdate={updateCatalogItem}
        />
      )}
    </div>
  );
}

function ReportsView({
  open,
  resolved,
  catalog,
  onResolve,
  onReopen,
  onAddToCatalog,
  onClearResolved,
}: {
  open: OosReport[];
  resolved: OosReport[];
  catalog: CatalogItem[];
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onAddToCatalog: (r: OosReport) => void;
  onClearResolved: () => void;
}) {
  const catalogNames = useMemo(
    () => new Set(catalog.map((c) => c.name.toLowerCase())),
    [catalog]
  );

  return (
    <div className="space-y-6">
      {open.length === 0 ? (
        <EmptyState
          title="Nothing flagged right now"
          sub="Staff submissions show up here as soon as they send them."
        />
      ) : (
        <div className="space-y-2.5">
          {open.map((r) => (
            <ReportRow
              key={r.id}
              report={r}
              inCatalog={catalogNames.has(r.item.toLowerCase())}
              onResolve={onResolve}
              onReopen={onReopen}
              onAddToCatalog={onAddToCatalog}
            />
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="card px-4 py-3">
          <summary className="cursor-pointer flex items-center justify-between gap-2">
            <div className="text-[14px] font-medium">
              Resolved{" "}
              <span className="text-[var(--muted)] font-normal">
                · {resolved.length}
              </span>
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                onClearResolved();
              }}
              className="btn-ghost !h-8 !text-[12px] text-[var(--danger)] border-[var(--danger-border)] hover:bg-[var(--danger-soft)]"
            >
              Clear resolved
            </button>
          </summary>
          <ul className="mt-3 space-y-2">
            {resolved.map((r) => (
              <ReportRow
                key={r.id}
                report={r}
                inCatalog={catalogNames.has(r.item.toLowerCase())}
                onResolve={onResolve}
                onReopen={onReopen}
                onAddToCatalog={onAddToCatalog}
              />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function ReportRow({
  report,
  inCatalog,
  onResolve,
  onReopen,
  onAddToCatalog,
}: {
  report: OosReport;
  inCatalog: boolean;
  onResolve: (id: string) => void;
  onReopen: (id: string) => void;
  onAddToCatalog: (r: OosReport) => void;
}) {
  const isOpen = report.status === "open";
  const resolvedDays =
    !isOpen && report.resolved_at ? daysSince(report.resolved_at) : null;
  const stale = resolvedDays !== null && resolvedDays >= 7;

  return (
    <li
      className={`card p-3.5 flex items-start gap-3 ${isOpen ? "" : stale ? "opacity-70" : "opacity-60"}`}
    >
      <div
        className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-md flex items-center justify-center bg-[var(--bg-elev)]"
        aria-hidden
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 5h6v2a3 3 0 0 1-6 0V5zM7 9h10l-1 10a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2L7 9z"
            stroke="var(--muted)"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`font-semibold text-[15px] tracking-tight ${isOpen ? "" : "line-through"}`}
          >
            {report.item}
          </span>
          {inCatalog && isOpen && (
            <span className="pill" style={{ color: "var(--ok)" }}>
              In list
            </span>
          )}
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
        <div className="text-[12.5px] text-[var(--muted)] mt-0.5 flex flex-wrap gap-x-2 items-center">
          {report.status_kind === "emergency" ? (
            <span className="pill pill-danger">Emergency</span>
          ) : report.status_kind === "out" ? (
            <span
              className="pill"
              style={{
                color: "var(--ink)",
                borderColor: "var(--border-strong)",
              }}
            >
              Out
            </span>
          ) : report.status_kind === "low" ? (
            <span
              className="pill num-mono"
              style={{
                color: "var(--warn)",
                background: "var(--warn-soft)",
                borderColor: "var(--warn-border)",
              }}
            >
              Low · {report.qty_left ?? "?"}
            </span>
          ) : null}
          {isOpen ? (
            <>
              <span>{report.submitted_by}</span>
              <span className="text-[var(--muted-2)]">·</span>
              <span className="num-mono">
                {relativeTime(report.created_at)}
              </span>
            </>
          ) : (
            <span
              className={
                stale ? "font-medium text-[var(--warn)]" : undefined
              }
            >
              Resolved{" "}
              {resolvedDays === 0
                ? "today"
                : resolvedDays === 1
                  ? "yesterday"
                  : `${resolvedDays}d ago`}{" "}
              · {report.submitted_by}
            </span>
          )}
        </div>
      </div>
      <div className="flex-shrink-0 flex flex-col gap-1.5">
        {isOpen && !inCatalog && (
          <button
            onClick={() => onAddToCatalog(report)}
            className="btn-ghost !h-8 !text-[12px]"
            title="Add to your list + mark resolved"
          >
            + To list
          </button>
        )}
        {isOpen ? (
          <button
            onClick={() => onResolve(report.id)}
            className="btn-ghost !h-8 !text-[12px]"
          >
            Resolve
          </button>
        ) : (
          <button
            onClick={() => onReopen(report.id)}
            className="btn-ghost !h-8 !text-[12px] !text-[var(--muted)]"
          >
            Reopen
          </button>
        )}
      </div>
    </li>
  );
}

function CatalogView({
  catalog,
  defaultDestination,
  onAdd,
  onRemove,
  onUpdate,
}: {
  catalog: CatalogItem[];
  defaultDestination: Destination;
  onAdd: (
    name: string,
    category: Category,
    destination: Destination,
    supplier: string | null
  ) => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CatalogItem>) => void;
}) {
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("grocery");
  const [newDestination, setNewDestination] =
    useState<Destination>(defaultDestination);
  const [newSupplier, setNewSupplier] = useState("");
  const [groupBy, setGroupBy] = useState<"supplier" | "category">("supplier");

  useEffect(() => {
    setNewDestination(defaultDestination);
  }, [defaultDestination]);

  const suppliers = useMemo(() => {
    const s = new Set<string>();
    for (const c of catalog) if (c.supplier) s.add(c.supplier);
    return Array.from(s).sort();
  }, [catalog]);

  const grouped = useMemo(() => {
    const map = new Map<string, CatalogItem[]>();
    for (const c of catalog) {
      const key =
        groupBy === "supplier" ? c.supplier || "Unassigned" : c.category;
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog, groupBy]);

  return (
    <div className="space-y-5">
      <div className="card p-3 space-y-3">
        <div className="field-label">Add to your list</div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Paper towels, Tito's 1L..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onAdd(
                  newName,
                  newCategory,
                  newDestination,
                  newSupplier || null
                );
                setNewName("");
              }
            }}
          />
          <button
            type="button"
            onClick={() => {
              if (newName.trim()) {
                onAdd(
                  newName,
                  newCategory,
                  newDestination,
                  newSupplier || null
                );
                setNewName("");
              }
            }}
            className="btn-primary !h-auto !py-3 !px-4"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 items-center text-[12px]">
          <Segmented<Category>
            value={newCategory}
            onChange={setNewCategory}
            options={[
              { value: "grocery", label: "Grocery" },
              { value: "alcohol", label: "Alcohol" },
            ]}
          />
          <Segmented<Destination>
            value={newDestination}
            onChange={setNewDestination}
            options={[
              { value: "owner", label: "Bob" },
              { value: "manager", label: "Mgr" },
            ]}
          />
          <input
            className="input !py-1.5 !px-3 !text-[12px] !w-[160px] ml-auto"
            placeholder="Supplier (optional)"
            list="catalog-suppliers"
            value={newSupplier}
            onChange={(e) => setNewSupplier(e.target.value)}
          />
          <datalist id="catalog-suppliers">
            {suppliers.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
      </div>

      {catalog.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="field-label">
            {catalog.length} {catalog.length === 1 ? "item" : "items"}
          </div>
          <div className="seg">
            <button
              data-on={groupBy === "supplier"}
              onClick={() => setGroupBy("supplier")}
            >
              By supplier
            </button>
            <button
              data-on={groupBy === "category"}
              onClick={() => setGroupBy("category")}
            >
              By category
            </button>
          </div>
        </div>
      )}

      {catalog.length === 0 ? (
        <EmptyState
          title="No items yet"
          sub="Add items above, or promote staff reports from the other tab."
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(([key, items]) => (
            <CatalogGroup
              key={key}
              label={key}
              items={items}
              suppliers={suppliers}
              onRemove={onRemove}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogGroup({
  label,
  items,
  suppliers,
  onRemove,
  onUpdate,
}: {
  label: string;
  items: CatalogItem[];
  suppliers: string[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CatalogItem>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="field-label capitalize">
        {label} · {items.length}
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {items.map((it) => (
          <CatalogRow
            key={it.id}
            item={it}
            suppliers={suppliers}
            onRemove={onRemove}
            onUpdate={onUpdate}
          />
        ))}
      </ul>
    </div>
  );
}

function CatalogRow({
  item,
  onRemove,
  onUpdate,
}: {
  item: CatalogItem;
  suppliers: string[];
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<CatalogItem>) => void;
}) {
  const [editingSupplier, setEditingSupplier] = useState(false);
  const [supplier, setSupplier] = useState(item.supplier ?? "");

  function commitSupplier() {
    setEditingSupplier(false);
    const next = supplier.trim() || null;
    if ((item.supplier ?? null) !== next) onUpdate(item.id, { supplier: next });
  }

  return (
    <li className="px-3 py-3 space-y-2 text-[14px]">
      <div className="flex items-start gap-3">
        <span className="flex-1 min-w-0">
          <span className="font-medium block truncate">{item.name}</span>
          <div className="text-[12px] text-[var(--muted)] mt-0.5">
            {editingSupplier ? (
              <input
                autoFocus
                list="catalog-suppliers"
                className="input !py-0.5 !px-1.5 !text-[12px] !w-[160px]"
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                onBlur={commitSupplier}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitSupplier();
                  if (e.key === "Escape") {
                    setSupplier(item.supplier ?? "");
                    setEditingSupplier(false);
                  }
                }}
                placeholder="Supplier"
              />
            ) : (
              <button
                onClick={() => setEditingSupplier(true)}
                className="hover:text-[var(--ink)] underline-offset-2 hover:underline"
              >
                {item.supplier || "+ supplier"}
              </button>
            )}
          </div>
        </span>
        <button
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name}`}
          className="flex-shrink-0 h-7 w-7 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-elev)] flex items-center justify-center"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Segmented<Category>
          value={item.category}
          onChange={(category) => onUpdate(item.id, { category })}
          options={[
            { value: "grocery", label: "Grocery" },
            { value: "alcohol", label: "Alcohol" },
          ]}
        />
        <Segmented<Destination>
          value={item.destination}
          onChange={(destination) => onUpdate(item.id, { destination })}
          options={[
            { value: "owner", label: "Bob" },
            { value: "manager", label: "Mgr" },
          ]}
        />
      </div>
    </li>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div
      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--bg-elev)] p-[2px] text-[11px] font-semibold"
      role="radiogroup"
    >
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => {
              if (!on) onChange(o.value);
            }}
            className="px-2.5 py-1 rounded-full transition-colors"
            style={{
              background: on ? "var(--ink)" : "transparent",
              color: on ? "var(--bg)" : "var(--muted)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="card py-12 px-6 text-center">
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
      <div className="font-semibold text-[15px]">{title}</div>
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
          <div className="h-8 w-8 rounded-md bg-[var(--bg-elev)] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-[var(--bg-elev)] animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-[var(--bg-elev)] animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
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

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}
