import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export const hasSupabase = Boolean(url && anonKey);

export type Category = "grocery" | "alcohol";
export type Status = "open" | "resolved";

export type OosReport = {
  id: string;
  item: string;
  category: Category;
  days_left: number;
  is_emergency: boolean;
  note: string | null;
  submitted_by: string;
  status: Status;
  created_at: string;
  resolved_at: string | null;
};
