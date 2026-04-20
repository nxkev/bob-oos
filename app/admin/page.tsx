import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminClient from "./admin-client";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login?next=/admin");

  const { data: row } = await supabase
    .from("allowed_emails")
    .select("role")
    .ilike("email", user.email)
    .maybeSingle();

  if (row?.role !== "admin") {
    return (
      <div className="card p-8 text-center space-y-2">
        <div className="text-[26px] font-semibold tracking-tight">
          Admins only
        </div>
        <p className="text-[var(--muted)]">
          Your account ({user.email}) doesn&apos;t have admin access. Ask Bob to
          promote you.
        </p>
      </div>
    );
  }

  const { data: allowed } = await supabase
    .from("allowed_emails")
    .select("*")
    .order("role", { ascending: true })
    .order("created_at", { ascending: true });

  return <AdminClient initial={allowed ?? []} currentEmail={user.email} />;
}
