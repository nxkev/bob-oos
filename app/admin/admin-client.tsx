"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AllowedEmail } from "@/lib/supabase";

export default function AdminClient({
  initial,
  currentEmail,
}: {
  initial: AllowedEmail[];
  currentEmail: string;
}) {
  const [users, setUsers] = useState<AllowedEmail[]>(initial);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "staff">("staff");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setError(null);
    setInfo(null);
    setBusy(true);

    const supabase = createClient();
    const { data: inserted, error: insertError } = await supabase
      .from("allowed_emails")
      .insert({
        email,
        role: inviteRole,
        created_by: currentEmail,
      })
      .select()
      .maybeSingle();

    if (insertError) {
      setBusy(false);
      setError(insertError.message);
      return;
    }

    const origin = window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });

    setBusy(false);

    if (otpError) {
      setError(
        `User added to whitelist, but invite email failed: ${otpError.message}. They can still sign in from /login.`
      );
    } else {
      setInfo(`Invite sent to ${email}.`);
    }

    if (inserted) setUsers((prev) => [...prev, inserted as AllowedEmail]);
    setInviteEmail("");
  }

  async function handleRemove(email: string) {
    if (email === currentEmail) {
      setError("You can't remove yourself.");
      return;
    }
    const ok = window.confirm(
      `Remove ${email}? They won't be able to sign in anymore.`
    );
    if (!ok) return;
    setError(null);
    setInfo(null);

    const prev = users;
    setUsers((cur) => cur.filter((u) => u.email !== email));
    const supabase = createClient();
    const { error: deleteError } = await supabase
      .from("allowed_emails")
      .delete()
      .eq("email", email);
    if (deleteError) {
      setUsers(prev);
      setError(deleteError.message);
    }
  }

  async function handleRoleChange(email: string, role: "admin" | "staff") {
    if (email === currentEmail && role === "staff") {
      setError("You can't demote yourself.");
      return;
    }
    setError(null);
    setInfo(null);
    const prev = users;
    setUsers((cur) => cur.map((u) => (u.email === email ? { ...u, role } : u)));
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("allowed_emails")
      .update({ role })
      .eq("email", email);
    if (updateError) {
      setUsers(prev);
      setError(updateError.message);
    }
  }

  async function handleResend(email: string) {
    setError(null);
    setInfo(null);
    const supabase = createClient();
    const origin = window.location.origin;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${origin}/auth/callback`,
        shouldCreateUser: true,
      },
    });
    if (otpError) setError(otpError.message);
    else setInfo(`Magic link re-sent to ${email}.`);
  }

  const admins = users.filter((u) => u.role === "admin");
  const staff = users.filter((u) => u.role === "staff");

  return (
    <div className="space-y-6">
      <header>
        <div className="field-label mb-2">Admin</div>
        <h1 className="text-[28px] leading-[1.1] font-semibold tracking-tight">
          Team access
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Invite someone by email. Supabase sends them a magic link to sign in.
          No passwords.
        </p>
      </header>

      <form onSubmit={handleInvite} className="card p-3 space-y-3">
        <div className="field-label">Invite someone</div>
        <div className="flex gap-2">
          <input
            type="email"
            inputMode="email"
            required
            className="input flex-1"
            placeholder="new@example.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !inviteEmail.trim()}
            className="btn-primary !h-auto !py-3 !px-4"
          >
            {busy ? "Sending…" : "Invite"}
          </button>
        </div>
        <div className="flex gap-2 text-[12px]">
          {(["staff", "admin"] as const).map((r) => (
            <button
              key={r}
              type="button"
              data-on={inviteRole === r}
              onClick={() => setInviteRole(r)}
              className="chip !min-h-0 !py-1.5 !px-3 !text-[12px] capitalize"
            >
              {r}
            </button>
          ))}
        </div>
      </form>

      {error && (
        <div className="rounded-[var(--radius)] border border-[var(--danger-border)] bg-[var(--danger-soft)] text-[var(--danger)] px-3 py-2 text-sm">
          {error}
        </div>
      )}
      {info && (
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--ok-soft)] text-[var(--ok)] px-3 py-2 text-sm">
          {info}
        </div>
      )}

      <Group
        title="Admins"
        users={admins}
        currentEmail={currentEmail}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
        onResend={handleResend}
      />
      <Group
        title="Staff"
        users={staff}
        currentEmail={currentEmail}
        onRoleChange={handleRoleChange}
        onRemove={handleRemove}
        onResend={handleResend}
      />
    </div>
  );
}

function Group({
  title,
  users,
  currentEmail,
  onRoleChange,
  onRemove,
  onResend,
}: {
  title: string;
  users: AllowedEmail[];
  currentEmail: string;
  onRoleChange: (email: string, role: "admin" | "staff") => void;
  onRemove: (email: string) => void;
  onResend: (email: string) => void;
}) {
  if (users.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="field-label">
        {title} · {users.length}
      </div>
      <ul className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        {users.map((u) => (
          <li
            key={u.email}
            className="flex items-center gap-2 px-3 py-2.5 text-[14px]"
          >
            <span className="flex-1 min-w-0">
              <span className="font-medium truncate">{u.email}</span>
              {u.email === currentEmail && (
                <span className="ml-2 text-[11px] text-[var(--muted)]">
                  (you)
                </span>
              )}
            </span>
            <button
              onClick={() => onResend(u.email)}
              className="btn-ghost !h-8 !text-[12px]"
              title="Send them a fresh magic link"
            >
              Resend link
            </button>
            <button
              onClick={() =>
                onRoleChange(u.email, u.role === "admin" ? "staff" : "admin")
              }
              className="btn-ghost !h-8 !text-[12px] capitalize"
              title="Toggle role"
            >
              {u.role === "admin" ? "Demote" : "Promote"}
            </button>
            <button
              onClick={() => onRemove(u.email)}
              aria-label={`Remove ${u.email}`}
              className="h-8 w-8 rounded-md text-[var(--muted)] hover:text-[var(--danger)] hover:bg-[var(--bg-elev)] flex items-center justify-center"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
