import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = searchParams.get("next") ?? "/";
  const errorParam = searchParams.get("error_description");

  if (errorParam) {
    const redirect = new URL("/login", origin);
    redirect.searchParams.set("error", errorParam);
    return NextResponse.redirect(redirect);
  }

  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      return NextResponse.redirect(new URL(next, origin));
    }
    const redirect = new URL("/login", origin);
    redirect.searchParams.set("error", error.message);
    return NextResponse.redirect(redirect);
  }

  const code = searchParams.get("code");
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
