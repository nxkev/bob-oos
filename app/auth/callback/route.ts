import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error_description");

  if (errorParam) {
    const redirect = new URL("/login", origin);
    redirect.searchParams.set("error", errorParam);
    return NextResponse.redirect(redirect);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    const redirect = new URL("/login", origin);
    redirect.searchParams.set("error", error.message);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.redirect(new URL("/login", origin));
}
